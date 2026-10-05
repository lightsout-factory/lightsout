import { join } from 'node:path';
import { readJsonFile } from '#src/common/json/readJsonFile.ts';
import { WorkOrderSyncState } from '#src/contracts/workOrder/WorkOrderSyncState.ts';
import { workOrderFileNames } from '#src/workOrder/common/constants/workOrderFileNames.ts';

interface Params {
	/** In the primary checkout. */
	workOrderFolder: string;
}

/**
 * Every failure answers undefined, which comparisons read as "no base", so
 * differing copies surface as a divergence rather than one silently overwriting
 * the other.
 */
export const readWorkOrderSyncState = async ({ workOrderFolder }: Params): Promise<WorkOrderSyncState | undefined> =>
	readJsonFile({ path: join(workOrderFolder, workOrderFileNames.sync), schema: WorkOrderSyncState });
