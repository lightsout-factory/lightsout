export interface GradeStamp {
	commit: string | undefined;
	/** `undefined` means the tree was NOT READ, never that it was read and found clean. */
	treeDirty: boolean | undefined;
}
