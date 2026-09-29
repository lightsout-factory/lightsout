/**
 * Advice is never re-checked the way a blocking site is, so the agent's own answer
 * is the only record, and the health report measures a rule's worth from it.
 *
 * `already-met` exists because the other two both misreport that case: `applied`
 * claims an edit that was not made, inflating the health report, and `declined`
 * says the advice was rejected.
 */
export const AdvisoryResponse = {
	Applied: 'applied',
	Declined: 'declined',
	/** The end-state the advice asks for was already true — nothing to do, and nothing rejected. */
	AlreadyMet: 'already-met',
} as const;

export type AdvisoryResponse = (typeof AdvisoryResponse)[keyof typeof AdvisoryResponse];
