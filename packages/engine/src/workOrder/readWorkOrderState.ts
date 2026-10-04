import { join } from 'node:path';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { workOrderFileNames } from '#src/workOrder/common/constants/workOrderFileNames.ts';
import { readWorkOrderStateFile } from '#src/workOrder/common/readWorkOrderStateFile.ts';

interface Params {
	/** Any checkout of the repository — the primary one, or a linked worktree. */
	cwd: string;
	/** The work order's label, which is also the branch its plans implement on. */
	name: string;
}

/**
 * No lock is taken: the store writes by rename, so a reader never meets a half-written file.
 * `{ record: undefined }` means only that no `state.json` exists; a corrupt record is an error.
 */
export const readWorkOrderState = async ({ cwd, name }: Params): Promise<{ record: WorkOrderState | undefined } | { error: string }> => {
	const workOrderFolder = await workOrderFolderDir({ cwd, name });

	return readWorkOrderStateFile({ statePath: join(workOrderFolder, workOrderFileNames.record), name });
};
