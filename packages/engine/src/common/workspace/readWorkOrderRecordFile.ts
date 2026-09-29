import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { workOrderStateFileName } from '#src/common/constants/workOrderStateFileName.ts';
import { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	/** One work order's own folder under the work-orders directory. */
	workOrderFolder: string;
}

/**
 * Answers undefined rather than a reason; `readWorkOrderStateFile` is the reader
 * that reports why. This lives under `common/` because `ship` and `worktree` need
 * it, and importing it from the work order module would close a cycle.
 */
export const readWorkOrderRecordFile = async ({ workOrderFolder }: Params): Promise<WorkOrderState | undefined> => {
	const text = await readFile(join(workOrderFolder, workOrderStateFileName), 'utf8').catch(() => undefined);

	if (text === undefined) {
		return undefined;
	}

	let value: unknown;

	try {
		value = JSON.parse(text);
	} catch {
		return undefined;
	}

	const parsed = WorkOrderState.safeParse(value);

	return parsed.success ? parsed.data : undefined;
};
