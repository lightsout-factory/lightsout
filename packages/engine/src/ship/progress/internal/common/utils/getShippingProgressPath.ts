import { join } from 'node:path';
import { resolveBranchRecordDir } from '#src/common/workspace/resolveBranchRecordDir.ts';

interface Params {
	/** Any checkout; the primary is resolved from it. */
	cwd: string;
	branch: string;
}

/** Undefined when no work order claims the branch: the record is filed with the work order's plans or not at all. */
export const getShippingProgressPath = async ({ cwd, branch }: Params): Promise<string | undefined> => {
	const folder = await resolveBranchRecordDir({ cwd, branch });

	return folder === undefined ? undefined : join(folder, 'ship-progress.json');
};
