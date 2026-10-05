import { readJsonFile } from '#src/common/json/readJsonFile.ts';
import { QueueSummary } from '#src/contracts/queue/QueueSummary.ts';
import { getQueueSummaryPath } from '#src/queue/board/common/getQueueSummaryPath.ts';

interface Params {
	/** The MAIN repository checkout the coordinator run lives in. */
	cwd: string;
	runId: string;
}

export const readQueueSummary = async ({ cwd, runId }: Params): Promise<QueueSummary | undefined> => {
	return readJsonFile({ path: await getQueueSummaryPath({ cwd, runId }), schema: QueueSummary });
};
