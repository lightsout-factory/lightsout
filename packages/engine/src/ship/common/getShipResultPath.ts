import { join } from 'node:path';
import { resolveBranchRecordDir } from '#src/common/workspace/resolveBranchRecordDir.ts';

interface Params {
	/** Any checkout of the repository; the primary is resolved from it. */
	cwd: string;
	branch: string;
}

/** Undefined when no work order claims the branch; the forge stays ship's durable record, which `findPullRequest` recovers from. */
export const getShipResultPath = async ({ cwd, branch }: Params): Promise<string | undefined> => {
	const folder = await resolveBranchRecordDir({ cwd, branch });

	return folder === undefined ? undefined : join(folder, 'ship.json');
};
