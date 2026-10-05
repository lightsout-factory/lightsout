/**
 * Deliberately not a record of implementation progress — that is the tracker's
 * own workflow status, and the queue selects on the pair of the two.
 */
export const PlanningStatus = {
	/** Human shaping is owed and has not started. The queue never selects it. */
	NeedsBrainstorm: 'planning-needs-brainstorm',
	/** Set by hand when someone wants to plan the ticket themselves, interactively. The queue never selects it. */
	NeedsPlan: 'planning-needs-plan',
	/** The input to autonomous planning: the queue plans this ticket, then implements the plan. */
	ReadyAutoPlan: 'planning-ready-auto-plan',
	/** All required human shaping is finished — an approved formal plan, or approved brainstorm material. */
	Complete: 'planning-complete',
	/** The ticket never required brainstorming or planning; its body is the whole specification. */
	NotNeeded: 'planning-not-needed',
} as const;

export type PlanningStatus = (typeof PlanningStatus)[keyof typeof PlanningStatus];
