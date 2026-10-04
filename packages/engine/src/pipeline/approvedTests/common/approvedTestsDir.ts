import { join } from 'node:path';
import { resolveRunDir } from '#src/common/resolveRunDir.ts';

interface Params {
	cwd: string;
	runId: string;
}

export const approvedTestsDir = async ({ cwd, runId }: Params): Promise<string> => {
	return join(await resolveRunDir({ cwd, runId }), 'approved');
};
