import { join } from 'node:path';
import type { WorkOrderSyncState } from '#src/contracts/workOrder/WorkOrderSyncState.ts';
import { workOrderFileNames } from '#src/workOrder/internal/common/constants/workOrderFileNames.ts';
import { readWorkOrderSyncState } from '#src/workOrder/internal/common/utils/readWorkOrderSyncState.ts';
import { writeWorkOrderFolderFile } from '#src/workOrder/internal/common/utils/writeWorkOrderFolderFile.ts';

interface Params {
	/** In the primary checkout. */
	workOrderFolder: string;
	recordSha256?: string;
	/** Merged key by key; a plan this call says nothing about keeps its hash. */
	planMarkers?: Record<string, string>;
}

/**
 * Merges rather than replaces, so publishing one plan never forgets another. The
 * caller holds the record's lock. A failure throws: an unwritten sidecar makes the
 * next pull report a false divergence.
 */
export const updateWorkOrderSyncState = async ({ workOrderFolder, recordSha256, planMarkers }: Params): Promise<void> => {
	const current = await readWorkOrderSyncState({ workOrderFolder });
	const recorded = recordSha256 ?? current?.recordSha256;
	const next: WorkOrderSyncState = {
		schemaVersion: 1,
		planMarkers: { ...current?.planMarkers, ...planMarkers },
	};

	if (recorded !== undefined) {
		next.recordSha256 = recorded;
	}

	await writeWorkOrderFolderFile({
		path: join(workOrderFolder, workOrderFileNames.sync),
		content: Buffer.from(`${JSON.stringify(next, undefined, '\t')}\n`, 'utf8'),
	});
};
