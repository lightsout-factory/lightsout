interface Params {
	/** The root run id of each family that is going. */
	roots: string[];
}

export const printAmbiguousRuns = ({ roots }: Params): void => {
	// Naming the ids rather than guessing: an unrelated concurrent run narrated
	// in place of the one the reader started is worse than being asked.
	console.error(`several runs are going: ${roots.join(', ')}`);
	console.error('pick one with --run <id>');
};
