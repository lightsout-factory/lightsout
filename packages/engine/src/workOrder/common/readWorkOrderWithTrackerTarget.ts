import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { resolveWorkOrderTrackerTarget } from '#src/workOrder/common/resolveWorkOrderTrackerTarget.ts';
import type { TicketTrackerTarget } from '#src/workOrder/common/types/TicketTrackerTarget.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	/** Any checkout; the primary is resolved inside. */
	cwd: string;
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
}

/**
 * The record is read first because it alone says which ticket the work order
 * belongs to. `localOnly` is handed back rather than answered here, because
 * what it means differs at every call site.
 */
export const readWorkOrderWithTrackerTarget = async ({
	cwd,
	name,
	config,
	env,
}: Params): Promise<{ record: WorkOrderState | undefined; target: TicketTrackerTarget | { localOnly: string } } | { error: string }> => {
	const held = await readWorkOrderState({ cwd, name });

	if ('error' in held) {
		return held;
	}

	const target = resolveWorkOrderTrackerTarget({ config, env, workOrderName: name, ticketRef: held.record?.ticketRef });

	return 'error' in target ? target : { record: held.record, target };
};
