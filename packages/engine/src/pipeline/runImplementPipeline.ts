import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import { commitRunWork } from '#src/commit/commitRunWork.ts';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { readGitPrefix } from '#src/common/git/readGitPrefix.ts';
import { excludedSourcePaths } from '#src/common/sourceFiles/excludedSourcePaths.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { removeApprovedTests } from '#src/pipeline/approvedTests/removeApprovedTests.ts';
import { prepareRun } from '#src/pipeline/internal/common/utils/prepareRun.ts';
import { resolveTestSubjects } from '#src/pipeline/internal/common/utils/resolveTestSubjects.ts';
import { runSteps } from '#src/pipeline/internal/common/utils/runSteps.ts';
import { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { buildSteps } from '#src/pipeline/steps/buildSteps/buildSteps.ts';
import { createRun } from '#src/runState/createRun.ts';
import { withRunLock } from '#src/runState/lock/withRunLock.ts';

// Later steps may have connected a file write-tests skipped to a public surface,
// so each is re-resolved; anything still orphaned stays under a named warning.
const recheckUnreachable = async ({ run }: { run: PipelineRun }) => {
	const recorded = run.current().unreachableChangedFiles;

	if (recorded.length === 0) {
		return;
	}

	const packagesDir = run.config['packages-dir'] ?? defaultPackagesDir;
	const compiler = resolveConsumerTypescript({ cwd: run.cwd, packagesDir });
	const universe = (await listSourceFiles({ cwd: run.cwd, exclude: excludedSourcePaths({ config: run.config }) })).files;
	const targets = recorded.filter((file) => universe.includes(file));
	const { orphans } = await resolveTestSubjects({ cwd: run.cwd, targets, universe, packagesDir, compiler });

	await run.update({ patch: { unreachableChangedFiles: orphans } });

	if (orphans.length > 0) {
		run.progress(
			`warning unreachable-changed-files: ${orphans.length} changed file(s) finished the run with no public surface reaching them: ${orphans.join(', ')} — they sit in an internal/ folder that no public file imports, so import them from one (or delete them) in follow-up work; no tests cover them.`,
		);
	}
};

/**
 * The commit runs before the approved copies are removed, because they are the
 * baseline a resume diffs against and a refused commit must leave them on disk,
 * and before the passed stamp, because a run stamped passed could not then be
 * failed by the commit.
 */
const finishRun = async ({ run, resumed }: { run: PipelineRun; resumed: boolean }): Promise<PipelineResult> => {
	await recheckUnreachable({ run });

	const uncommitted = await commitRunWork({ run, driver: run.driver, resumed });
	let result: PipelineResult;

	if (uncommitted === undefined) {
		// Every step passed, so the approved copies have no reader left. A failed,
		// parked or escalated run never reaches here and keeps them.
		await removeApprovedTests({ run });
		await run.update({ patch: { status: RunStatus.Passed, currentStep: null } });

		result = { ok: true, manifest: run.current() };
	} else {
		await run.update({ patch: { status: RunStatus.Failed } });

		result = { ok: false, manifest: run.current(), error: uncommitted };
	}

	return result;
};

interface Params {
	cwd: string;
	driver: Driver;
	config: LightsoutConfig;
	/** Minted by the caller so the run can be named before it starts. Ignored when resuming. */
	runId?: string;
	/** Ignored when resuming (the manifest owns it). */
	planPath?: string;
	/** Ignored when resuming. */
	overviewPath?: string;
	/** Ignored when resuming: the existing manifest already carries it. */
	parentRunId?: string;
	/** Falls back to the plan front-matter `packages:` list. */
	packages?: string[];
	/** Resume: steps already passed are skipped. */
	existing?: RunManifest;
	/** Supplied only when a resumed sequence reaches a phase that had not started, so there is no child manifest to adopt. It seeds the baseline in place of a fresh git snapshot. */
	inheritedBaseline?: string[];
	skipRefactor?: boolean;
	/** Absent wherever no run is being recorded. */
	level?: ActivityLevel;
	/** Ignored when resuming: the existing manifest already carries it. */
	willShip?: boolean;
	onProgress?: (message: string) => void;
}

/**
 * Every state transition is persisted before the next action, so a crash, park
 * or escalation leaves a resumable record; resume re-enters here and walks past
 * every step already passed.
 */
const executePipeline = async ({
	cwd,
	runId,
	driver,
	config,
	planPath,
	overviewPath,
	parentRunId,
	packages,
	existing,
	inheritedBaseline,
	skipRefactor,
	level,
	willShip,
	onProgress,
}: Params & { runId: string }): Promise<PipelineResult> => {
	const run = new PipelineRun({
		cwd,
		config,
		driver,
		level,
		onProgress,
		manifest:
			existing ??
			(await createRun({
				cwd,
				runId,
				plan: planPath ?? '',
				pipeline: PipelineKind.Implement,
				overview: overviewPath,
				parentRunId,
				driver: driver.name,
				config,
				baselineDirtyFiles: inheritedBaseline ?? (await readGitChangedFiles({ cwd })),
				willShip,
			})),
	});
	const prepared = await prepareRun({ run, cwd, config, packages });

	if ('error' in prepared) {
		return run.stop({
			record: { id: 'clean-slate', status: RunStatus.Running, attempts: 0 },
			status: RunStatus.Failed,
			error: prepared.error,
		});
	}

	const { planContent, overviewContent, standards, testStandards } = prepared;

	// Agents in a consumer nested inside a larger git repo sometimes echo
	// repo-root-relative paths.
	const gitPrefix = await readGitPrefix({ cwd });
	const steps = buildSteps({ run, gitPrefix, planContent, overviewContent, standards, testStandards, skipRefactor });

	// Only now is the exact step sequence known, --skip-refactor included.
	await run.update({ patch: { status: RunStatus.Running, stepOrder: steps.map((step) => step.id) } });

	const stopped = await runSteps({ run, steps });

	if (stopped) {
		return stopped;
	}

	return finishRun({ run, resumed: inheritedBaseline !== undefined || existing !== undefined });
};

/** The refactor pipeline takes the same repo lock, so the two can never race one tree. */
export const runImplementPipeline = (params: Params): Promise<PipelineResult> => withRunLock({ params, run: executePipeline });
