import type { Driver } from '#src/common/types/Driver.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { appendReviewFindings } from '#src/runState/appendReviewFindings.ts';
import { runStandardsReview } from '#src/standardsCheck/runStandardsReview.ts';

interface Params {
	cwd: string;
	/** Provenance for the ledger line. */
	runId: string;
	driver: Driver;
	batch: RefactorBatch;
	groups: StandardsGroup[];
	/** The batch's own files before it works, the ones it wrote after. */
	files: string[];
	/** Monorepo package parent dir, so each finding is graded by its file's package group. */
	packagesDir: string;
	/** false skips the agent entirely — deterministic-checks-only mode. */
	agentReview: boolean;
	timeoutMs: number;
	onProgress: (message: string) => void;
}

/**
 * Findings go to the review ledger before any caller acts: no deterministic check
 * can rediscover an agent-check finding, so a run that parks or escalates first would
 * otherwise lose the only account of it.
 */
export const runBatchReview = async ({
	cwd,
	runId,
	driver,
	batch,
	groups,
	files,
	packagesDir,
	agentReview,
	timeoutMs,
	onProgress,
}: Params): Promise<StandardsFinding[]> => {
	if (!agentReview) {
		return [];
	}

	const review = await runStandardsReview({
		cwd,
		driver,
		groups,
		files,
		packagesDir,
		timeoutMs,
		onProgress: (message) => onProgress(`${batch.id}: ${message}`),
	});

	for (const note of review.notes) {
		onProgress(`${batch.id}: ${note}`);
	}

	await appendReviewFindings({ cwd, runId, step: batch.id, findings: review.findings });

	return review.findings;
};
