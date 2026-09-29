import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';

interface Params {
	/** A plan address, or a work order's name. */
	name: string;
}

/**
 * The key the branch, the worktree path and the worktree's ownership record are
 * built from, so every plan of one ticket lands in the same tree on the same branch.
 */
export const workOrderNameOf = ({ name }: Params): string => parsePlanAddress({ name })?.workOrderName ?? name;
