import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { listRunIds } from '#src/runState/listRunIds.ts';
import { readRunLiveness } from '#src/runState/readRunLiveness.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { readRunListing } from '#src/views/internal/common/utils/readRunListing.ts';

interface Params {
	cwd: string;
	/** Narrow the read to one ticket's runs folder; without it, every run this repo has. */
	workOrderName?: string;
}

/** A run whose manifest will not read is skipped in silence, so one corrupt directory cannot take the whole history down. */
export const listRuns = async ({ cwd, workOrderName }: Params): Promise<RunListing[]> => {
	const listings: RunListing[] = [];

	for (const runId of await listRunIds({ cwd, workOrderName })) {
		const manifest = await readRunManifest({ cwd, runId }).catch(() => undefined);

		if (manifest === undefined) {
			continue;
		}

		const { live } = await readRunLiveness({ cwd, manifest });

		listings.push(await readRunListing({ cwd, manifest, live }));
	}

	return listings.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
};
