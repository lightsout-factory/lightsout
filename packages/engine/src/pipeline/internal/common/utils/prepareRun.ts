import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { listWorkspacePackages } from '#src/common/workspace/listWorkspacePackages.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { readPlanSources } from '#src/pipeline/internal/common/utils/readPlanSources.ts';
import { resolvePackageScope } from '#src/pipeline/internal/common/utils/resolvePackageScope.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { ResolvedStandards } from '#src/standards/ResolvedStandards.ts';
import { resolveStandards } from '#src/standards/resolveStandards.ts';

interface Params {
	run: PipelineRun;
	cwd: string;
	config: LightsoutConfig;
	/** The `--packages` flag, when the caller passed one. */
	packages?: string[];
}

interface Prepared {
	planContent: string;
	overviewContent?: string;
	standards?: string;
	testStandards?: string;
}

/**
 * Scope is settled before standards because the standards cover the scoped
 * packages, and both come before any gate, since a gate scoped to a guess
 * proves nothing. Failures are returned rather than thrown so the caller can
 * record them against the run.
 *
 * Prose is resolved once, here, for the run's starting scope plus the repo
 * root group. A step that later finds files in another package does not
 * re-resolve it: the checks and the refactor step resolve their own groups for
 * the widened scope, so those files are still graded by their own package's
 * pack.
 */
export const prepareRun = async ({ run, cwd, config, packages }: Params): Promise<Prepared | { error: string }> => {
	const manifest = run.current();
	const sources = await readPlanSources({ cwd, plan: manifest.plan, overview: manifest.overview });

	if ('error' in sources) {
		return sources;
	}

	const packagesDir = config['packages-dir'] ?? defaultPackagesDir;
	const knownPackages = await listWorkspacePackages({ cwd, packagesDir });
	const scope = resolvePackageScope({
		config,
		current: manifest.packages,
		packages,
		planContent: sources.planContent,
		packagesDir,
		knownPackages,
	});

	// Above the error check on purpose: the run that most needs this line is the
	// one where every prose name was fiction, and that run returns an error.
	if (scope.ignored) {
		run.progress(`ignored plan package paths: ${scope.ignored.join(', ')} — no such package under ${packagesDir}/`);
	}

	if ('error' in scope) {
		return scope;
	}

	if (scope.scope) {
		await run.update({ patch: scope.scope });
	}

	if (run.current().packages.length > 0) {
		run.progress(`package scope: ${run.current().packages.join(', ')} (from ${run.current().packagesSource ?? 'manifest'})`);
	}

	let resolved: ResolvedStandards;
	// An empty scope covers every workspace package plus the root group, never the root alone.
	const scoped = run.current().packages;

	try {
		resolved = await resolveStandards({ cwd, config, packages: scoped.length > 0 ? scoped : undefined });
	} catch (error) {
		return { error: messageOf({ error }) };
	}

	return { ...sources, standards: resolved.standards, testStandards: resolved.testStandards };
};
