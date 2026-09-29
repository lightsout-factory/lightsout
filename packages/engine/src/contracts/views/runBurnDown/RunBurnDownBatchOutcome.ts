/**
 * `NotRun` also covers a batch whose recorded report will not parse: either way
 * its sites stay where the work-list froze them.
 */
export const RunBurnDownBatchOutcome = {
	Resolved: 'resolved',
	Declined: 'declined',
	NotRun: 'not-run',
} as const;

export type RunBurnDownBatchOutcome = (typeof RunBurnDownBatchOutcome)[keyof typeof RunBurnDownBatchOutcome];
