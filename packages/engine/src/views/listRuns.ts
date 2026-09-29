import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { listRunIds } from '#src/runState/listRunIds.ts';
import { readRunProcessLock } from '#src/runState/lock/readRunProcessLock.ts';
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

		// Per run rather than once: the run lock is per-checkout, so an isolated
		// run's holder is in the workspace it recorded rather than here.
		listings.push(await readRunListing({ cwd, manifest, lock: await readRunProcessLock({ cwd, manifest }) }));
	}

	return listings.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
};
