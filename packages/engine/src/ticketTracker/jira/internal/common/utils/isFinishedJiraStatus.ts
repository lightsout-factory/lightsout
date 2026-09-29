interface Params {
	/** The status category's key, or undefined when the status carries no category. */
	categoryKey: string | undefined;
}

/**
 * A status with no readable category answers false, so a blocker whose category
 * could not be read stays a blocker: waiting one extra run is recoverable,
 * shipping a dependent ahead of its blocker is not.
 */
export const isFinishedJiraStatus = ({ categoryKey }: Params): boolean => categoryKey === 'done';
