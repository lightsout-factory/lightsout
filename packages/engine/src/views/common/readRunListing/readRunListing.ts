import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { readFrozenWorklist } from '#src/views/common/readFrozenWorklist.ts';
import { buildRunListing } from '#src/views/common/readRunListing/buildRunListing.ts';
import type { FrozenWorklist } from '#src/views/common/types/FrozenWorklist.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
	/** Whether a live process stands behind the run, as `readRunLiveness` answered. */
	live: boolean;
	/** The run's frozen work-list when the caller already read it — the run detail reads it once and shares it with the burn-down. */
	worklist?: FrozenWorklist;
}

export const readRunListing = async ({ cwd, manifest, live, worklist }: Params): Promise<RunListing> => {
	const frozen = worklist ?? (manifest.plan.endsWith('worklist.json') ? await readFrozenWorklist({ cwd, manifest }) : undefined);

	return buildRunListing({ manifest, live, worklist: frozen });
};
