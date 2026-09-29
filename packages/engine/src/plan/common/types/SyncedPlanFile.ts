export interface SyncedPlanFile {
	/** Absolute path of the plan file. */
	path: string;
	/** True when the section differed and the file was rewritten. */
	updated: boolean;
}
