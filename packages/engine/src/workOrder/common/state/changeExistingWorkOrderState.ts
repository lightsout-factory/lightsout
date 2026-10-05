import type { WorkOrderStateChange } from '#src/common/types/WorkOrderStateChange.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { requireWorkOrderState } from '#src/workOrder/common/state/requireWorkOrderState.ts';
import { updateSyncedWorkOrderState } from '#src/workOrder/common/state/updateSyncedWorkOrderState.ts';

interface Params {
	/** Any checkout of the repository. */
	cwd: string;
	/** Also the branch its plans implement on. */
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
	/** A ticket with no record, and one that has shipped, never reach it. */
	change: (record: WorkOrderState) => WorkOrderState | { error: string };
}

/**
 * The shared refusals (no record, already shipped) live here so no operation can
 * forget one. The change runs inside the store's callback, so a refusal leaves
 * the record's bytes untouched.
 */
export const changeExistingWorkOrderState = async ({
	cwd,
	name,
	config,
	env,
	onProgress,
	change,
}: Params): Promise<WorkOrderStateChange | { error: string }> => {
	const updated = await updateSyncedWorkOrderState({
		cwd,
		name,
		config,
		env,
		onProgress,
		change: (current) => {
			const record = requireWorkOrderState({ record: current, name });

			return 'error' in record ? record : change(record);
		},
	});

	return 'error' in updated ? updated : { record: updated.record, publishError: updated.publishError };
};
