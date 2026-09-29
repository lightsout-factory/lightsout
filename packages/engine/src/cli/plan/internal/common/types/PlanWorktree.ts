/**
 * Separate from `RunWorkspace`, which it mirrors, because `RunWorkspace` is the
 * shape a run manifest's recorded workspace is read back through. Not named
 * `PlanWorkspace`: that phrase already means the plan's folder.
 */
export interface PlanWorktree {
	/** Absolute path of the checkout every plan subcommand acts on. */
	cwd: string;
	/** The branch the tree stands on — the plan's work order's branch. Absent when isolation is off. */
	branch?: string;
	isolated: boolean;
	/** True when THIS invocation cut the tree. */
	created: boolean;
}
