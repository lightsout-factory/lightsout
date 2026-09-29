/**
 * Derived from which files exist and whether a passed run names one of them,
 * never stored, so it cannot go stale.
 */
export const PlanStage = {
	/** A workspace with no notes and no drafted plan yet — facts, decisions or transcripts only. */
	Started: 'started',
	/** `brainstorm-notes.md` exists and nothing has been drafted. */
	NotesOnly: 'notes-only',
	Drafted: 'drafted',
	Graded: 'graded',
	Implemented: 'implemented',
} as const;

export type PlanStage = (typeof PlanStage)[keyof typeof PlanStage];
