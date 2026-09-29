/**
 * Three entry points place a ticket's tree at the same path on the same branch,
 * so the owner has to be recorded; a drain leaves a tree it does not own alone.
 *
 * Planning continues in a `Queue` tree without re-stamping it, but an
 * implementation run re-stamps a `Plan` tree to `Implement`, because ownership
 * is what licenses the post-ship removal.
 */
export const WorktreeOwner = {
	Queue: 'queue',
	Implement: 'implement',
	Plan: 'plan',
} as const;

export type WorktreeOwner = (typeof WorktreeOwner)[keyof typeof WorktreeOwner];
