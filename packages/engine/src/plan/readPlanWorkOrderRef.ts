import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';
import { readWorkOrderRecordFile } from '#src/common/workspace/readWorkOrderRecordFile.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';

interface Params {
	/** Any checkout of the repository; the record is found in its primary checkout. */
	cwd: string;
	/** A plan address, or a work order's label on its own. */
	name: string;
}

/**
 * Never reads a ticket id out of the name: a label like `phase-2-cleanup` is
 * only a label, and `ticketRef` is the one field that says which ticket the
 * work belongs to.
 */
export const readPlanWorkOrderRef = async ({ cwd, name }: Params): Promise<string | undefined> => {
	const record = await readWorkOrderRecordFile({ workOrderFolder: await workOrderFolderDir({ cwd, name: workOrderNameOf({ name }) }) });

	return record?.ticketRef;
};
