import { WorkOrderShipStateKind } from '#src/common/constants/WorkOrderShipStateKind.ts';
import type { ShipWorkOrderGuard } from '#src/common/types/ShipWorkOrderGuard.ts';
import { resolveWorkOrderNameForBranch } from '#src/common/workspace/resolveWorkOrderNameForBranch.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { appendWorkOrderEvent } from '#src/workOrder/common/appendWorkOrderEvent.ts';
import { updateSyncedWorkOrderState } from '#src/workOrder/common/state/updateSyncedWorkOrderState.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';
import { readWorkOrderShipEligibility } from '#src/workOrder/shipping/readWorkOrderShipEligibility/readWorkOrderShipEligibility.ts';
import { readWorkOrderShipState } from '#src/workOrder/shipping/readWorkOrderShipState.ts';

interface Params {
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

/**
 * What the shipped event says shipped: a passed build from the ticket body, hand-built work and
 * who authorized it, or the included plans. A plan-less record with neither changed between the
 * last `authorize` and the merge, so it carries no attribution rather than a false one.
 */
const describeShipped = ({ record, planIds, mergeCommit }: { record: WorkOrderState; planIds: string[]; mergeCommit: string }) => {
	const state = readWorkOrderShipState({ record });
	const shipped = `work order ${record.name} shipped as ${mergeCommit}`;
	let detail = shipped;

	if (state.kind === WorkOrderShipStateKind.TicketBodyPassed) {
		detail = `${shipped} from the ticket body`;
	} else if (state.kind === WorkOrderShipStateKind.HandBuiltAuthorized) {
		detail = `${shipped} as hand-built work authorized by ${state.by}`;
	} else if (planIds.length > 0) {
		detail = `${shipped} with ${planIds.join(', ')}`;
	}

	return detail;
};

/**
 * `authorize` pulls first, so a machine never authorizes a merge against a
 * record it knows is behind, and a pull failure is a refusal: a record that
 * cannot be established cannot authorize anything. Both members find the record
 * by the branch it saves, falling back to the local record labelled with the
 * branch's own name; a machine holding no local record checks nothing.
 */
export const createWorkOrderShipGuard = ({ config, env, onProgress }: Params): ShipWorkOrderGuard => ({
	authorize: async ({ cwd, branch }) => {
		const name = await resolveWorkOrderNameForBranch({ cwd, branch });
		const pulled = await pullWorkOrderState({ cwd, name, config, env, onProgress });

		if ('error' in pulled) {
			const local = await readWorkOrderState({ cwd, name });

			// An unreadable tracker must not stop a branch with no record here: it
			// belongs to no work order, so no ticket record governs its ship.
			return 'error' in local || local.record !== undefined ? pulled.error : undefined;
		}

		if (pulled.record === undefined) {
			return undefined;
		}

		const eligibility = readWorkOrderShipEligibility({ record: pulled.record });

		return eligibility.eligible ? undefined : eligibility.reason;
	},
	recordShipped: async ({ cwd, branch, mergeCommit }) => {
		const name = await resolveWorkOrderNameForBranch({ cwd, branch });
		const read = await readWorkOrderState({ cwd, name });

		if ('error' in read) {
			onProgress?.(`the merge ${mergeCommit} could not be recorded on the ticket: ${read.error}`);

			return;
		}

		// Shipping a branch with no record never invents one.
		if (read.record === undefined) {
			return;
		}

		const at = new Date().toISOString();
		const updated = await updateSyncedWorkOrderState({
			cwd,
			name,
			config,
			env,
			onProgress,
			change: (current) => {
				if (current === undefined) {
					return { error: `work order ${name} no longer has a record, so the merge ${mergeCommit} could not be recorded on it` };
				}

				const planIds = current.plans.filter((plan) => plan.exclusion === undefined).map((plan) => plan.id);

				return appendWorkOrderEvent({
					record: { ...current, shipped: { at, planIds, mergeCommit } },
					kind: WorkOrderEventKind.Shipped,
					detail: describeShipped({ record: current, planIds, mergeCommit }),
					at,
				});
			},
		});

		// A merge that already happened is never undone by a record that would not
		// take it, so both failures are reported rather than raised.
		if ('error' in updated) {
			onProgress?.(`the merge ${mergeCommit} could not be recorded on the ticket: ${updated.error}`);
		} else if (updated.publishError !== undefined) {
			onProgress?.(updated.publishError);
		}
	},
});
