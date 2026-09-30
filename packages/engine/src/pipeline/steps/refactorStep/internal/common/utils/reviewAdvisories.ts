import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import { runStandardsReview } from '#src/standardsCheck/runStandardsReview.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';

interface Params {
	run: PipelineRun;
	packs: LoadedStandardsLibrary[];
	channels: string[];
	/** Repo-relative files to review; an empty list spends no agent. */
	files: string[];
}

/**
 * Never throws: a review that could not run narrates why and contributes nothing, because the
 * deterministic checks are the real evidence and must not wait on an opinion.
 */
export const reviewAdvisories = async ({ run, packs, channels, files }: Params): Promise<StandardsFinding[]> => {
	const review = await runStandardsReview({
		cwd: run.cwd,
		driver: run.driver,
		packs,
		channels,
		files,
		timeoutMs: run.agentTimeoutMs,
		onProgress: (message) => run.progress(message),
	});

	for (const note of review.notes) {
		run.progress(note);
	}

	return review.findings;
};
