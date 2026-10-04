import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorkOrderListing } from '#src/common/types/WorkOrderListing.ts';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';
import { workOrderFileNames } from '#src/workOrder/common/constants/workOrderFileNames.ts';
import { readWorkOrderStateFile } from '#src/workOrder/common/readWorkOrderStateFile.ts';

interface Params {
	/** Any checkout of the repository: the records this machine holds are found from it. */
	cwd: string;
}

/**
 * A folder whose record will not parse is named in `unreadable` rather than dropped: a look-up may
 * ignore it, but creation cannot, because an invisible work order is how one ticket comes to have
 * two. No cached index: it would be a second copy of the truth the record exists to be.
 */
export const listWorkOrders = async ({ cwd }: Params): Promise<{ found: WorkOrderListing[]; unreadable: string[] }> => {
	const folder = await workOrdersDir({ cwd });
	const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
	const found: WorkOrderListing[] = [];
	const unreadable: string[] = [];

	for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
		const read = await readWorkOrderStateFile({ statePath: join(folder, entry.name, workOrderFileNames.record), name: entry.name });

		if ('error' in read || read.record === undefined) {
			unreadable.push(entry.name);
		} else {
			found.push({ name: entry.name, record: read.record });
		}
	}

	return {
		found: found.sort((first, second) => first.name.localeCompare(second.name)),
		unreadable: unreadable.sort((first, second) => first.localeCompare(second)),
	};
};
