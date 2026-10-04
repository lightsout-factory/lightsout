/**
 * Joined by one slash — `lo-140-multi/001-record` — as the `--name` value and
 * the plan's folder. The branch, worktree and ownership record are keyed by
 * `workOrderName` alone, because every plan of one ticket implements on that
 * one branch.
 */
export interface PlanAddress {
	workOrderName: string;
	planId: string;
}
