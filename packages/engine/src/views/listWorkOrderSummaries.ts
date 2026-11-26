import { readdir } from 'node:fs/promises';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';
import type { WorkOrderSummary } from '#src/contracts/views/workOrder/WorkOrderSummary.ts';
import { readWorkOrderSummary } from '#src/views/common/readWorkOrderSummary.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	cwd: string;
}

/**
 * A folder whose record is missing or will not parse is skipped in silence, so
 * one corrupt work order cannot take the whole list down; a repo with no
 * work-orders folder holds none.
 */
export const listWorkOrderSummaries = async ({ cwd }: Params): Promise<WorkOrderSummary[]> => {
	const entries = await readdir(await workOrdersDir({ cwd }), { withFileTypes: true }).catch(() => []);
	const summaries: WorkOrderSummary[] = [];

	for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
		const read = await readWorkOrderState({ cwd, name: entry.name });

		if ('record' in read && read.record !== undefined) {
			const { summary } = await readWorkOrderSummary({ cwd, name: entry.name, record: read.record });

			summaries.push(summary);
		}
	}

	return summaries.sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
};
