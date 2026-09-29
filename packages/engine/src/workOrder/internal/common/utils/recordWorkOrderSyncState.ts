import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { workOrderFileNames } from '#src/workOrder/internal/common/constants/workOrderFileNames.ts';
import { updateWorkOrderSyncState } from '#src/workOrder/internal/common/utils/updateWorkOrderSyncState.ts';
import { withWorkOrderStateLock } from '#src/workOrder/internal/common/utils/withWorkOrderStateLock.ts';

interface Params {
	/** In the primary checkout. */
	workOrderFolder: string;
	/** SHA-256 of the record bytes this machine has just published or taken. */
	recordSha256?: string;
	/** Keyed by plan id. */
	planMarkers?: Record<string, string>;
	/** Prefixes the error: what had already succeeded when the write failed. */
	failure: string;
	/** Set when a surfaced published copy has been settled and must go once the sidecar is written. */
	dropSurfacedCopy?: boolean;
}

/**
 * A failure here is never the whole command's failure: the bytes already
 * landed, and only this machine's memory of them is lost, which the next
 * `lightsout work-order sync` rebuilds.
 */
export const recordWorkOrderSyncState = async ({
	workOrderFolder,
	recordSha256,
	planMarkers,
	failure,
	dropSurfacedCopy,
}: Params): Promise<{ error: string } | undefined> => {
	const recorded = await withWorkOrderStateLock({
		workOrderFolder,
		run: async (): Promise<{ error: string } | undefined> => {
			try {
				await updateWorkOrderSyncState({ workOrderFolder, recordSha256, planMarkers });

				if (dropSurfacedCopy === true) {
					await rm(join(workOrderFolder, workOrderFileNames.published), { force: true });
				}

				return undefined;
			} catch (error) {
				return { error: `${failure}: ${messageOf({ error })}` };
			}
		},
	});

	return recorded;
};
