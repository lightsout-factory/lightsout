import type { SprawlLane } from '#src/features/sprawl/internal/common/constants/SprawlLane.ts';
import type { SprawlDataset } from '#src/features/sprawl/internal/common/contracts/SprawlDataset.ts';
import type { SprawlLaneState } from '#src/features/sprawl/internal/common/types/SprawlLaneState.ts';

interface Params {
	dataset: SprawlDataset;
	lane: SprawlLane;
}

/** The dataset never changes, so each lane is replayed once rather than on every animation tick. */
const cache = new WeakMap<SprawlDataset, Map<SprawlLane, SprawlLaneState[]>>();

/**
 * Removals arrive in `removedFiles` and `removedFolders`, so `lines: 0` in
 * `files` is a real emptied file, not a deletion sentinel.
 */
export const buildSprawlLaneStates = ({ dataset, lane }: Params): SprawlLaneState[] => {
	const perLane = cache.get(dataset) ?? new Map<SprawlLane, SprawlLaneState[]>();
	const cached = perLane.get(lane);

	if (cached !== undefined) {
		return cached;
	}

	const states: SprawlLaneState[] = [];
	let files = new Map<string, number>();
	let folders = new Map<string, number>();

	for (const frame of dataset.frames) {
		const delta = frame[lane];

		files = new Map(files);
		folders = new Map(folders);

		for (const path of delta.removedFiles) {
			files.delete(path);
		}

		for (const path of delta.removedFolders) {
			folders.delete(path);
		}

		for (const file of delta.files) {
			files.set(file.path, file.lines);
		}

		for (const folder of delta.folders) {
			folders.set(folder.path, folder.entries);
		}

		states.push({ files, folders, overCap: delta.overCap });
	}

	perLane.set(lane, states);
	cache.set(dataset, perLane);

	return states;
};
