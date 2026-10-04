import { join } from 'node:path';
import { resolveRunDir } from '#src/common/resolveRunDir.ts';

interface Params {
	cwd: string;
	runId: string;
}

export const getProgressLogPath = async ({ cwd, runId }: Params): Promise<string> => {
	return join(await resolveRunDir({ cwd, runId }), 'progress.jsonl');
};
