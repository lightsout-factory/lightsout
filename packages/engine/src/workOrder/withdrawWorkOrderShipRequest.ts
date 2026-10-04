import type { WorkOrderStateChange } from '#src/common/types/WorkOrderStateChange.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { changeExistingWorkOrderState } from '#src/workOrder/common/changeExistingWorkOrderState.ts';
import { recordShipRequestWithdrawal } from '#src/workOrder/common/recordShipRequestWithdrawal.ts';

interface Params {
	/** Any checkout of the repository: the one record this machine holds is found from it. */
	cwd: string;
	/** The work order's label, which is also the branch its plans implement on. */
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

/** Recorded rather than cleared, so a later reader sees a finish line was declared and then taken back. */
export const withdrawWorkOrderShipRequest = ({ cwd, name, config, env, onProgress }: Params): Promise<WorkOrderStateChange | { error: string }> =>
	changeExistingWorkOrderState({
		cwd,
		name,
		config,
		env,
		onProgress,
		change: (record) =>
			record.shipRequest === undefined
				? { error: `work order ${name} carries no ship request, so there is nothing to withdraw` }
				: recordShipRequestWithdrawal({
						record,
						detail: `the request to ship ${record.shipRequest.planIds.join(', ')} was withdrawn by hand`,
						at: new Date().toISOString(),
					}),
	});
