import { join } from 'node:path';
import { approvedTestsDir } from '#src/pipeline/approvedTests/common/approvedTestsDir.ts';

interface Params {
	cwd: string;
	runId: string;
	/** Repo-relative path of the test-side file. */
	path: string;
}

export const approvedTestPath = async ({ cwd, runId, path }: Params): Promise<string> => {
	return join(await approvedTestsDir({ cwd, runId }), path);
};
