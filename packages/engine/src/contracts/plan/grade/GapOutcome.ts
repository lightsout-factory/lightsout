/**
 * `needs-a-human` blocks; `agent-can-decide` and `already-answered` print as
 * notes and gate nothing.
 *
 * `unjudged` is not the judge's to return: the engine stamps it on a finding no
 * judge settled, and it blocks like `needs-a-human`, because failing open would
 * let an unweighed finding pass as a clean bill.
 */
export const GapOutcome = {
	NeedsAHuman: 'needs-a-human',
	AgentCanDecide: 'agent-can-decide',
	AlreadyAnswered: 'already-answered',
	Unjudged: 'unjudged',
} as const;

export type GapOutcome = (typeof GapOutcome)[keyof typeof GapOutcome];
