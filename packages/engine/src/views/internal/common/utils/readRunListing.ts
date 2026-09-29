import type { RunLock } from '#src/contracts/run/RunLock.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import type { FrozenWorklist } from '#src/views/internal/common/types/FrozenWorklist.ts';
import { buildRunListing } from '#src/views/internal/common/utils/buildRunListing.ts';
import { readFrozenWorklist } from '#src/views/internal/common/utils/readFrozenWorklist.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
	lock: RunLock | undefined;
	/** The run's frozen work-list when the caller already read it — the run detail reads it once and shares it with the burn-down. */
	worklist?: FrozenWorklist;
}

export const readRunListing = async ({ cwd, manifest, lock, worklist }: Params): Promise<RunListing> => {
	const frozen = worklist ?? (manifest.plan.endsWith('worklist.json') ? await readFrozenWorklist({ cwd, manifest }) : undefined);

	return buildRunListing({ manifest, lock, worklist: frozen });
};
