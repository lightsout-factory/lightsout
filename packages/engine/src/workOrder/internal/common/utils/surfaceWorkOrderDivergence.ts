import { join } from 'node:path';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { workOrderFileNames } from '#src/workOrder/internal/common/constants/workOrderFileNames.ts';
import { writeWorkOrderFolderFile } from '#src/workOrder/internal/common/utils/writeWorkOrderFolderFile.ts';

interface Params {
	/** In the primary checkout. The caller holds its lock. */
	workOrderFolder: string;
	name: string;
	ticketRef: string;
	/** The published record's normalised bytes, saved beside the local record for the human to read. */
	content: Buffer;
}

/** Nothing is overwritten or published: both copies hold real work, and only a person can say which the ticket keeps. */
export const surfaceWorkOrderDivergence = async ({ workOrderFolder, name, ticketRef, content }: Params): Promise<string> => {
	const sync = `lightsout work-order sync --name ${name}`;
	let saved = `the published copy is saved beside it as ${workOrderFileNames.published}`;

	try {
		await writeWorkOrderFolderFile({ path: join(workOrderFolder, workOrderFileNames.published), content });
	} catch (error) {
		saved = `the published copy could not be saved as ${workOrderFileNames.published} (${messageOf({ error })})`;
	}

	return `the work order state for '${name}' moved both here and on ${ticketRef} since this machine last synced — ${saved}; run \`${sync} --keep local\` to publish this machine's copy over it, or \`${sync} --keep published\` to take the ticket's copy instead`;
};
