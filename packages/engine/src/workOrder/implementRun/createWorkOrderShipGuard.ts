import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import type { ShipWorkOrderGuard } from '#src/ship/common/types/ShipWorkOrderGuard.ts';
import { appendWorkOrderEvent } from '#src/workOrder/internal/common/record/appendWorkOrderEvent.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';
import { readWorkOrderShipEligibility } from '#src/workOrder/readWorkOrderShipEligibility.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';
import { updateSyncedWorkOrderState } from '#src/workOrder/updateSyncedWorkOrderState.ts';

interface Params {
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

/**
 * `authorize` pulls first, so a machine never authorizes a merge against a
 * record it knows is behind, and a pull failure is a refusal: a record that
 * cannot be established cannot authorize anything.
 */
export const createWorkOrderShipGuard = ({ config, env, onProgress }: Params): ShipWorkOrderGuard => ({
	authorize: async ({ cwd, branch }) => {
		// The branch IS the work order's label.
		const pulled = await pullWorkOrderState({ cwd, name: branch, config, env, onProgress });

		if ('error' in pulled) {
			const local = await readWorkOrderState({ cwd, name: branch });

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
		const read = await readWorkOrderState({ cwd, name: branch });

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
			name: branch,
			config,
			env,
			onProgress,
			change: (current) => {
				if (current === undefined) {
					return { error: `work order ${branch} no longer has a record, so the merge ${mergeCommit} could not be recorded on it` };
				}

				const planIds = current.plans.filter((plan) => plan.exclusion === undefined).map((plan) => plan.id);
				// No included plan means the build came from the ticket body.
				const shippedWith = planIds.length === 0 ? 'from the ticket body' : `with ${planIds.join(', ')}`;

				return appendWorkOrderEvent({
					record: { ...current, shipped: { at, planIds, mergeCommit } },
					kind: WorkOrderEventKind.Shipped,
					detail: `work order ${branch} shipped as ${mergeCommit} ${shippedWith}`,
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
