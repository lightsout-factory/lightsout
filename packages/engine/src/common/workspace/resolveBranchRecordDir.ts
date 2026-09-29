import { findWorkOrderForBranch } from '#src/common/workspace/findWorkOrderForBranch.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';

interface Params {
	/** Any checkout of the repository; the primary is resolved from it. */
	cwd: string;
	/** The branch as git names it. */
	branch: string;
}

/**
 * Undefined is a real answer: a folder invented for a branch no work order claims
 * would be a phantom work order. Callers read it as "this branch keeps no local
 * record".
 */
export const resolveBranchRecordDir = async ({ cwd, branch }: Params): Promise<string | undefined> => {
	const listing = await findWorkOrderForBranch({ cwd, branch });

	return listing === undefined ? undefined : workOrderFolderDir({ cwd, name: listing.name });
};
