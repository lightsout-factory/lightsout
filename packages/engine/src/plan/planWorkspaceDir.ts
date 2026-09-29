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
 * The one answer to where a plan lives: a single gitignored folder holding both
 * the transient working files (`facts.json`, `decisions.json`, the agent
 * transcripts) and the drafted plan text — `plan.md`, or `overview.md` plus its
 * `phase<N>-<slug>.md` files.
 *
 * An address answers that plan's own subfolder inside its ticket's plans folder;
 * a work order's name answers the plans folder itself, which holds one subfolder
 * per plan. Putting plans one level below the ticket folder is what keeps the
 * ticket's own record files and its `runs/` sibling out of every scan that looks
 * for them.
 *
 * Always under the primary checkout, whichever checkout the command runs in, the
 * way `resolveSharedStateDir` answers for shared run state. A planning worktree
 * is removed once its work ships, so a plan folder written inside one dies with
 * it — and a worktree holds code work only.
 */
export const planWorkspaceDir = async ({ cwd, name }: Params): Promise<string> => {
	const address = parsePlanAddress({ name });
	const workOrderName = address?.workOrderName ?? name;
	const plansFolder = join(await workOrderFolderDir({ cwd, name: workOrderName }), 'plans');

	return address === undefined ? plansFolder : join(plansFolder, address.planId);
};
