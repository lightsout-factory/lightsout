import { readJsonFile } from '#src/common/json/readJsonFile.ts';
import { QueueBoard } from '#src/contracts/queue/QueueBoard.ts';
import { getQueueBoardPath } from '#src/queue/board/getQueueBoardPath.ts';

interface Params {
	/** The MAIN repository checkout the coordinator run lives in. */
	cwd: string;
	runId: string;
}

export const readQueueBoard = async ({ cwd, runId }: Params): Promise<QueueBoard | undefined> => {
	return readJsonFile({ path: await getQueueBoardPath({ cwd, runId }), schema: QueueBoard });
};
