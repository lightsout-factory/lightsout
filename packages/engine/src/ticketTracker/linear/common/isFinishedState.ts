interface Params {
	/** Undefined when the state could not be read. */
	stateType: string | undefined;
}

/** Canceled counts as finished: a ticket someone gave up on must not block its dependent forever. */
const finishedStateTypes = new Set(['completed', 'canceled']);

/**
 * An unreadable state answers false, so the blocker stays a blocker: waiting one
 * extra run is recoverable, shipping a dependent ahead of its blocker is not.
 */
export const isFinishedState = ({ stateType }: Params): boolean => stateType !== undefined && finishedStateTypes.has(stateType);
