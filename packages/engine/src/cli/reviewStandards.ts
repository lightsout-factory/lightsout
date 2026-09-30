import { defaultAgentTimeoutMinutes } from '#src/common/constants/defaultAgentTimeoutMinutes.ts';
import { excludedSourcePaths } from '#src/common/sourceFiles/excludedSourcePaths.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { getDriver } from '#src/drivers/getDriver.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import { runStandardsReview } from '#src/standardsCheck/runStandardsReview.ts';

interface Params {
	cwd: string;
	config?: LightsoutConfig;
	/** Repo-relative subtree to review — absent means the whole repo. */
	path?: string;
	onProgress?: (message: string) => void;
}

// Resolved here rather than by the runner, so a run that never asks for the
// review never loads a pack or a harness for it.
export const reviewStandards = async ({ cwd, config, path, onProgress }: Params): Promise<{ findings: StandardsFinding[]; notes: string[] }> => {
	const groups = await resolveStandardsGroups({ cwd, config });
	const { files: walked } = await listSourceFiles({ cwd, exclude: excludedSourcePaths({ config }) });
	const files = walked.filter((file) => !path || file.startsWith(path));

	return runStandardsReview({
		cwd,
		driver: getDriver({ name: config?.harness ?? 'claude-code' }),
		groups,
		files,
		timeoutMs: (config?.timeouts?.['agent-minutes'] ?? defaultAgentTimeoutMinutes) * 60_000,
		onProgress,
	});
};
