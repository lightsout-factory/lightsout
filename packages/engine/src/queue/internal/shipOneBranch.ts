import type { ShipIntegration } from '#src/common/types/ShipIntegration.ts';
import type { ShipSettings } from '#src/common/types/ShipSettings.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { BranchPhase } from '#src/contracts/queue/BranchPhase.ts';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { takeGateHold } from '#src/gates/gateHolds/takeGateHold.ts';
import { writeBranchState } from '#src/queue/branchState/writeBranchState.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import { runShip } from '#src/ship/runShip/runShip.ts';
import { reconcileShippedTicket } from '#src/ticketLifecycle/reconcileShippedTicket/reconcileShippedTicket.ts';
import { createWorkOrderShipGuard } from '#src/workOrder/implementRun/createWorkOrderShipGuard.ts';
import { deleteWorktreeRecord } from '#src/worktree/records/deleteWorktreeRecord.ts';
import { removeWorktree } from '#src/worktree/removeWorktree.ts';

interface Params {
	/** The main repository checkout. */
	cwd: string;
	config: LightsoutConfig;
	shipSettings: ShipSettings;
	/** The effective config and harness the shared ship sequence's integration step verifies and repairs with. */
	integration: ShipIntegration;
	defaultBranch: string;
	/** The process environment the tracker credentials are read from. Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
	outcome: WorkOrderRunOutcome;
	/** The coordinator run's id, recorded on any hold this merge has to take. */
	runId: string;
	/** Runs a task with no other main-checkout git mutation in flight. The merge tail removes a worktree there while builders may be adding one. */
	serializeMainCheckout: <Result>(params: { task: () => Promise<Result> }) => Promise<Result>;
	onProgress?: (message: string) => void;
}

/**
 * The branch is recorded merged first, so a process killed anywhere in this tail
 * never leaves it ready to merge again. The ownership record goes only when the
 * tree really came down: a record dropped beside a standing tree leaves it unclaimed.
 *
 * The Done write is last, and a tracker that refuses it does not flip `ready`.
 */
const settleLandedMerge = async ({
	cwd,
	config,
	env,
	outcome,
	ticketRef,
	mergeCommit,
	serializeMainCheckout,
	onProgress,
}: {
	cwd: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	outcome: WorkOrderRunOutcome;
	/** The shipped result's `ticketRef` and `mergeCommit`, optional because `ShipResult` states them in prose rather than in the type. */
	ticketRef: string | undefined;
	mergeCommit: string | undefined;
	serializeMainCheckout: Params['serializeMainCheckout'];
	onProgress?: (message: string) => void;
}) => {
	await writeBranchState({ cwd, branch: outcome.branch, phase: BranchPhase.Merged, onProgress });
	// A builder may be adding a worktree in the same turn, so the removal takes the shared chain.
	const removal = await serializeMainCheckout({ task: () => removeWorktree({ cwd, worktreePath: outcome.worktreePath, branch: outcome.branch }) });

	if (removal === undefined) {
		await deleteWorktreeRecord({ cwd, branch: outcome.branch });
	}
	onProgress?.(`${outcome.ticket.identifier} · shipped as ${mergeCommit}`);

	return reconcileShippedTicket({ config, env, ticketRef, onProgress });
};

/**
 * `ready` survives exactly when the merge landed, which tells the drain a tracker
 * re-read is worth making: only a merge can free a blocked ticket.
 *
 * A park writes no record, so the branch stays recorded ready and the next run
 * re-ships it rather than rebuilding it. The exception is a ship the ticket
 * record does not authorize: that is a ticket still open, so the branch is
 * recorded open and goes back to its worker instead of retrying the same refusal.
 *
 * The caller must never run two at a time, or integrating `origin/<default>`
 * would mean nothing.
 */
export const shipOneBranch = async ({
	cwd,
	config,
	shipSettings,
	integration,
	defaultBranch,
	env,
	outcome,
	runId,
	serializeMainCheckout,
	onProgress,
}: Params): Promise<WorkOrderRunOutcome> => {
	const park = ({ error }: { error: string }) => {
		onProgress?.(`${outcome.ticket.identifier} · not shipped: ${error}`);

		return { ...outcome, ready: false, error };
	};

	onProgress?.(`${outcome.ticket.identifier} · merging ${outcome.branch} into origin/${defaultBranch}`);

	const shipped = await runShip({
		cwd: outcome.worktreePath,
		settings: shipSettings,
		integration,
		workOrderGuard: createWorkOrderShipGuard({ config, env, onProgress }),
		onProgress,
	});

	// The hold makes the stop stick until a human releases it. Taken after
	// `runShip` returned, so no gate reservation is held while the tracker calls run.
	if (shipped.status === ShipStatus.Blocked && shipped.reason === ShipBlockReason.IntegrationGatesUnavailable) {
		const coordination = shipped.detail ?? 'the shared gate reservation was never acquired';
		const holdFailure = await takeGateHold({
			cwd,
			config,
			env,
			ticketRef: outcome.ticket.identifier,
			runId,
			worktreePath: outcome.worktreePath,
			reason: coordination,
			onProgress,
		});

		return park({ error: holdFailure === undefined ? coordination : `${coordination} ${holdFailure}` });
	}

	if (shipped.status === ShipStatus.Blocked && shipped.reason === ShipBlockReason.WorkOrderNotAuthorized) {
		const waiting = shipped.detail ?? 'the branch’s ticket record does not authorize shipping it';

		onProgress?.(`${outcome.ticket.identifier} · left open: ${waiting}`);
		await writeBranchState({ cwd, branch: outcome.branch, phase: BranchPhase.Open, onProgress });

		return { ...outcome, ready: false, open: waiting };
	}

	if (shipped.status === ShipStatus.Blocked) {
		return park({ error: `${shipped.reason}: ${shipped.detail}` });
	}

	const reconciliationFailure = await settleLandedMerge({
		cwd,
		config,
		env,
		outcome,
		ticketRef: shipped.ticketRef,
		mergeCommit: shipped.mergeCommit,
		serializeMainCheckout,
		onProgress,
	});

	return reconciliationFailure === undefined ? outcome : { ...outcome, reconciliationFailure };
};
