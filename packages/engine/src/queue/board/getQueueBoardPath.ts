import { join } from 'node:path';
import { resolveRunDir } from '#src/runState/common/paths/resolveRunDir.ts';

interface Params {
	/** The MAIN repository checkout the coordinator run lives in. */
	cwd: string;
	runId: string;
}

export const getQueueBoardPath = async ({ cwd, runId }: Params): Promise<string> => {
	return join(await resolveRunDir({ cwd, runId }), 'board.json');
};
