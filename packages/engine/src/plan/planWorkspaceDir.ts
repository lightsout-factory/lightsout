import { join } from 'node:path';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';

interface Params {
	/** The directory the command runs in — a primary checkout, a linked worktree, or no repository at all. */
	cwd: string;
	/** A plan address, or a work order's name for its plans folder as a whole. */
	name: string;
}

/**
 * Plans sit one level below the ticket folder, which keeps the ticket's own
 * record files and its `runs/` sibling out of every scan for them.
 *
 * Always under the primary checkout, whichever checkout the command runs in, as
 * `resolveSharedStateDir` is: a planning worktree is removed once its work
 * ships, and a plan folder written inside one would die with it.
 */
export const planWorkspaceDir = async ({ cwd, name }: Params): Promise<string> => {
	const address = parsePlanAddress({ name });
	const workOrderName = address?.workOrderName ?? name;
	const plansFolder = join(await workOrderFolderDir({ cwd, name: workOrderName }), 'plans');

	return address === undefined ? plansFolder : join(plansFolder, address.planId);
};
