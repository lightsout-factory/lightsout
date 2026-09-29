/**
 * `Declined` is a recorded judgment: the agent reported complete with no changes
 * while site keys persist. It never fails the run by itself.
 */
export const BatchOutcome = {
	Resolved: 'resolved',
	Declined: 'declined',
} as const;

export type BatchOutcome = (typeof BatchOutcome)[keyof typeof BatchOutcome];
