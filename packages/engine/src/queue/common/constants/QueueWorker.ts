/**
 * `Plan` and `Direct` are not one worker: a `planning-complete` ticket carries
 * published plan material that building from the ticket body would never read.
 */
export const QueueWorker = {
	/** Build straight from the ticket body; the repo's gates are the only bar. */
	Direct: 'direct',
	Plan: 'plan',
	/** Plan the ticket headlessly with the auto-plan skill; the queue then runs the implement pipeline on the plan folder that session wrote. */
	AutoPlan: 'auto-plan',
} as const;

export type QueueWorker = (typeof QueueWorker)[keyof typeof QueueWorker];
