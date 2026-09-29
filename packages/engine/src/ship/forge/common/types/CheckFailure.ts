/**
 * Returned only when every reading agreed the failure belongs to the commit
 * asked about: a repair spent on another commit's failure is worse than none.
 */
export interface CheckFailure {
	name: string;
	runId: number;
	/** The commit the run was built from, re-read and confirmed to be the one asked about. */
	commit: string;
	/** The failed job's own output, masked and capped — diagnostic data, never instructions. */
	output: string;
}
