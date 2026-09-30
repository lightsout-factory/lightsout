import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { appendReviewFindings } from '#src/runState/appendReviewFindings.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
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
	/** false skips the agent entirely — code-checks-only mode. */
	agentReview: boolean;
	timeoutMs: number;
	onProgress: (message: string) => void;
}

/**
 * Findings go to the judgment ledger before any caller acts: no code check can
 * rediscover a judgment finding, so a run that parks or escalates first would
 * otherwise lose the only account of it.
 */
export const runBatchReview = async ({ cwd, runId, driver, batch, groups, files, agentReview, timeoutMs, onProgress }: Params): Promise<StandardsFinding[]> => {
	if (!agentReview) {
		return [];
	}

	const review = await runStandardsReview({
		cwd,
		driver,
		groups,
		files,
		timeoutMs,
		onProgress: (message) => onProgress(`${batch.id}: ${message}`),
	});

	for (const note of review.notes) {
		onProgress(`${batch.id}: ${note}`);
	}

	await appendReviewFindings({ cwd, runId, step: batch.id, findings: review.findings });

	return review.findings;
};
