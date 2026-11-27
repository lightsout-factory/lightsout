/** A section of a plan's evidence summary; an absent section means its step never ran, so there is no member for that. */
export const EvidenceSectionState = {
	/** The step behind the section is still going: planning live, or the build run running, pending or paused. */
	InProgress: 'in-progress',
	/** The step ran and stopped. Empty figures in a finished section are evidence that it found nothing. */
	Finished: 'finished',
} as const;

export type EvidenceSectionState = (typeof EvidenceSectionState)[keyof typeof EvidenceSectionState];
