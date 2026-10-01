/** How a stop attempt on one pid ended. */
export const StopProcessOutcome = {
	Exited: 'exited',
	Killed: 'killed',
	Survived: 'survived',
	Refused: 'refused',
} as const;

export type StopProcessOutcome = (typeof StopProcessOutcome)[keyof typeof StopProcessOutcome];
