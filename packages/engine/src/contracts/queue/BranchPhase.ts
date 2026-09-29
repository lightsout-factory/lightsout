/**
 * Each value is written only by the step that makes it true; nothing infers a phase from a
 * worktree directory or from whether a session committed. `Open` means the branch may not
 * ship yet: a multiple-plan ticket's record does not authorize it, or the ship step refused it.
 */
export const BranchPhase = {
	Building: 'building',
	Ready: 'ready',
	Open: 'open',
	Merged: 'merged',
} as const;

export type BranchPhase = (typeof BranchPhase)[keyof typeof BranchPhase];
