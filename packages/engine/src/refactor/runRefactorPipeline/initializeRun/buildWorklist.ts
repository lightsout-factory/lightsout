import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { batchFindings } from '#src/refactor/batch/batchFindings.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck/runStandardsCheck.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
	/** Repo-relative check scope (default: the whole repo). */
	path?: string;
	/** Include baselined findings — burn-down mode. */
	all?: boolean;
}

/**
 * Computed from the tree, never hand-written; the caller freezes it for the
 * run, so it is never recomputed mid-run.
 */
export const buildWorklist = async ({ cwd, config, path, all = false }: Params): Promise<RefactorWorklist> => {
	const { findings } = await runStandardsCheck({ cwd, config, path, all, persist: false });

	return {
		at: new Date().toISOString(),
		path: path ?? '.',
		all,
		batches: batchFindings({
			blocking: findings.filter((finding) => finding.severity === StandardsSeverity.Blocking),
			// Every advisory, not just the size ones: a rule whose advisories never
			// reach the agent can never be judged, only reported to a human.
			advisories: findings.filter((finding) => finding.severity === StandardsSeverity.Advisory),
			packagesDir: config['packages-dir'] ?? defaultPackagesDir,
		}),
	};
};
