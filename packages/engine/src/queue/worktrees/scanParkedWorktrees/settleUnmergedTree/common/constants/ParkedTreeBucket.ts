/**
 * Each value names what happens next: `Drain` returns the branch to a worker, `Ship` sends it to
 * the merge, and `Unreadable` means git would not answer, reported rather than guessed at.
 */
export const ParkedTreeBucket = {
	Unreadable: 'unreadable',
	Drain: 'drain',
	Ship: 'ship',
} as const;

export type ParkedTreeBucket = (typeof ParkedTreeBucket)[keyof typeof ParkedTreeBucket];
