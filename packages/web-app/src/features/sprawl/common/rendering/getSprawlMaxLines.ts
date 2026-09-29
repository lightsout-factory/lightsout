import { buildSprawlLaneStates } from '#src/features/sprawl/common/rendering/buildSprawlLaneStates.ts';
import { SprawlLane } from '#src/features/sprawl/internal/common/constants/SprawlLane.ts';
import type { SprawlDataset } from '#src/features/sprawl/internal/common/contracts/SprawlDataset.ts';

interface Params {
	dataset: SprawlDataset;
}

const cache = new WeakMap<SprawlDataset, number>();

/**
 * One scale for both lanes: the without lane's summed-back files are taller by
 * construction, and scaled to itself each lane would look the same.
 */
export const getSprawlMaxLines = ({ dataset }: Params): number => {
	const cached = cache.get(dataset);

	if (cached !== undefined) {
		return cached;
	}

	let maxLines = 0;

	for (const lane of [SprawlLane.With, SprawlLane.Without]) {
		for (const state of buildSprawlLaneStates({ dataset, lane })) {
			for (const lines of state.files.values()) {
				maxLines = Math.max(maxLines, lines);
			}
		}
	}

	cache.set(dataset, maxLines);

	return maxLines;
};
