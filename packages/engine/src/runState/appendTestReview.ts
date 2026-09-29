import type { TestReviewRecord } from '#src/contracts/run/TestReviewRecord.ts';
import { appendRunLog } from '#src/runState/internal/common/utils/appendRunLog.ts';

interface Params {
	cwd: string;
	runId: string;
	record: TestReviewRecord;
}

/**
 * Every review is recorded, clean or refused: a checkpoint that approved all
 * its test-side changes is evidence just as much as one that went red.
 */
export const appendTestReview = async ({ cwd, runId, record }: Params): Promise<void> => {
	await appendRunLog({ cwd, runId, fileName: 'test-reviews.jsonl', record });
};
