import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readWorkOrderRecordFile } from '#src/common/workspace/readWorkOrderRecordFile.ts';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';
import type { WorkOrderListing } from '#src/workOrder/common/types/WorkOrderListing.ts';

interface Params {
	/** Any checkout of the repository; the primary is resolved from it. */
	cwd: string;
	/** The branch as git names it. */
	branch: string;
}

/**
 * Found by reading the records, never by deriving anything from the branch
 * string, and compared exactly. Folders are walked in sorted order so two records
 * naming one branch always answer the same way.
 *
 * There is deliberately no cached index: it would be a second copy of the truth.
 */
export const findWorkOrderForBranch = async ({ cwd, branch }: Params): Promise<WorkOrderListing | undefined> => {
	const folder = await workOrdersDir({ cwd });
	const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
	const names = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((first, second) => first.localeCompare(second));
	let found: WorkOrderListing | undefined;

	for (const name of names) {
		const record = await readWorkOrderRecordFile({ workOrderFolder: join(folder, name) });

		if (record?.branch === branch) {
			found = { name, record };
			break;
		}
	}

	return found;
};
