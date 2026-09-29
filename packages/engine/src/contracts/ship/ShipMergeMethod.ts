/** Spelled as `gh pr merge` spells its flags, so the configured name travels to the command line unchanged. */
export const ShipMergeMethod = {
	Merge: 'merge',
	Squash: 'squash',
	Rebase: 'rebase',
} as const;

export type ShipMergeMethod = (typeof ShipMergeMethod)[keyof typeof ShipMergeMethod];
