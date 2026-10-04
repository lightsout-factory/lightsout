import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { runStandardsReview } from '#src/standardsCheck/runStandardsReview/runStandardsReview.ts';

interface Params {
	run: PipelineRun;
	groups: StandardsGroup[];
	/** Repo-relative files to review; an empty list spends no agent. */
	files: string[];
}

/**
 * Never throws: a review that could not run narrates why and contributes nothing, because the
 * deterministic checks are the real evidence and must not wait on an opinion.
 */
export const reviewAdvisories = async ({ run, groups, files }: Params): Promise<StandardsFinding[]> => {
	const review = await runStandardsReview({
		cwd: run.cwd,
		driver: run.driver,
		groups,
		files,
		packagesDir: run.config['packages-dir'] ?? defaultPackagesDir,
		timeoutMs: run.agentTimeoutMs,
		onProgress: (message) => run.progress(message),
	});

	for (const note of review.notes) {
		run.progress(note);
	}

	return review.findings;
};
