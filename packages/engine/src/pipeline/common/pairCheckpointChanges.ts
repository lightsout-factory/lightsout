import type { CheckpointComparison } from '#src/pipeline/common/types/CheckpointComparison.ts';

interface Params {
	removed: string[];
	added: string[];
	modified: string[];
	/** Where a removed path should be now, or the path itself when nothing declared covers it. */
	destinationOf: ({ path }: { path: string }) => string;
	/** Each unpaired side's refusal wording, in the check's own terms. */
	wording: { uncovered: string; destination: string; unclaimed: string };
}

/**
 * Pairs each removed file with the file added at its declared destination. A
 * rename or a move never creates or deletes a file, so anything left unpaired is
 * a change nothing declared explains, and is refused.
 *
 * @returns every pair and in-place modification to compare, and one refusal line per unpaired path
 */
export const pairCheckpointChanges = ({
	removed,
	added,
	modified,
	destinationOf,
	wording,
}: Params): { comparisons: CheckpointComparison[]; refusals: string[] } => {
	const unclaimed = new Set(added);
	const comparisons: CheckpointComparison[] = modified.map((path) => ({ startPath: path, currentPath: path }));
	const refusals: string[] = [];

	for (const path of removed) {
		const destination = destinationOf({ path });

		if (destination === path) {
			refusals.push(`- ${path}: removed, and ${wording.uncovered}`);
		} else if (unclaimed.delete(destination)) {
			comparisons.push({ startPath: path, currentPath: destination });
		} else {
			refusals.push(`- ${path}: removed, but nothing was added at its ${wording.destination} ${destination}`);
		}
	}

	for (const path of unclaimed) {
		refusals.push(`- ${path}: added, but ${wording.unclaimed}`);
	}

	return { comparisons, refusals };
};
