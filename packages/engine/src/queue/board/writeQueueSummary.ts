import { writeJsonFile } from '#src/common/writeJsonFile.ts';
import type { QueueSummary } from '#src/contracts/queue/QueueSummary.ts';
import { getQueueSummaryPath } from '#src/queue/board/common/getQueueSummaryPath.ts';

interface Params {
	/** The MAIN repository checkout the coordinator run lives in. */
	cwd: string;
	/** The queue coordinator run's id. */
	runId: string;
	summary: QueueSummary;
}

/**
 * Written atomically, so a reader never sees half a summary.
 *
 * @throws {RunNotFoundError} When the queue run has no folder — a drain that found nothing to do created none.
 */
export const writeQueueSummary = async ({ cwd, runId, summary }: Params): Promise<void> => {
	await writeJsonFile({ path: await getQueueSummaryPath({ cwd, runId }), value: summary, atomic: true });
};
