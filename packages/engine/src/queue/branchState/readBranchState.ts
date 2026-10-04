import { readJsonFile } from '#src/common/readJsonFile.ts';
import { BranchState } from '#src/contracts/queue/BranchState.ts';
import { getBranchStatePath } from '#src/queue/branchState/common/getBranchStatePath.ts';

interface Params {
	/** Any checkout of the repository; the primary is resolved from it. */
	cwd: string;
	branch: string;
}

/**
 * Undefined means "nobody has recorded this branch", never "the branch is
 * building": the parked scan is the one place that decides an unrecorded
 * branch, by looking at git.
 */
export const readBranchState = async ({ cwd, branch }: Params): Promise<BranchState | undefined> => {
	const path = await getBranchStatePath({ cwd, branch });

	return path === undefined ? undefined : readJsonFile({ path, schema: BranchState });
};
