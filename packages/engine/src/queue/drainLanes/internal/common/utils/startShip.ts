import { messageOf } from '#src/common/messageOf.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import type { LaneContext } from '#src/queue/drainLanes/internal/common/types/LaneContext.ts';
import type { LaneFlight } from '#src/queue/drainLanes/internal/common/types/LaneFlight.ts';
import type { LaneState } from '#src/queue/drainLanes/internal/common/types/LaneState.ts';
import { trackTask } from '#src/queue/drainLanes/internal/common/utils/trackTask.ts';
import { shipOneBranch } from '#src/queue/internal/shipOneBranch.ts';

interface Params {
	context: LaneContext;
	state: LaneState;
	flight: LaneFlight;
}

/** One branch merged and settled — never rejecting, because a rejection reaching the drain's race would abandon every branch still waiting. */
const mergeBranch = async ({ context, state, outcome }: { context: LaneContext; state: LaneState; outcome: WorkOrderRunOutcome }) => {
	try {
		const shipped = await shipOneBranch({
			cwd: context.cwd,
			config: context.config,
			shipSettings: context.shipSettings,
			integration: context.shipIntegration,
			defaultBranch: context.defaultBranch,
			env: context.env,
			outcome,
			runId: context.runId,
			serializeMainCheckout: context.serializeMainCheckout,
			onProgress: context.onProgress,
		});

		state.shipping = undefined;
		state.outcomes.push(shipped);

		if (shipped.ready) {
			// The merge landed, so a blocker may have just finished.
			state.rescanRequested = true;
			state.idleScanSpent = false;
		}
	} catch (thrown) {
		// Settled the way the merge's own park path does: worktree intact, and no
		// re-scan, because nothing landed.
		state.shipping = undefined;
		state.outcomes.push({ ...outcome, ready: false, error: messageOf({ error: thrown }) });
	}
};

/**
 * Tests the builds in flight, not the retired slots, so a budget whose builders
 * are all retired still merges what is finished. Runs before the builders, so a
 * freed slot goes to a branch already waiting.
 */
export const startShip = ({ context, state, flight }: Params): void => {
	const waiting = flight.ships > 0 || flight.builds >= context.settings.maxParallel ? undefined : state.readyToShip.shift();

	if (waiting !== undefined) {
		state.shipping = waiting;
		flight.ships += 1;
		trackTask({
			flight,
			run: async () => {
				await mergeBranch({ context, state, outcome: waiting });
				flight.ships -= 1;
			},
		});
	}
};
