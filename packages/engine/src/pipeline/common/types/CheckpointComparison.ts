/** One file a mechanical check compares: its path at the phase's starting commit and its path now, the same path when it did not move. */
export interface CheckpointComparison {
	startPath: string;
	currentPath: string;
}
