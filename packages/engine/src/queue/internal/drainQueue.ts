import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { GateHolds } from '#src/gates/gateHolds/common/types/GateHolds.ts';
import type { QueueBoardRecorder } from '#src/queue/board/QueueBoardRecorder.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { QueueDrainReport } from '#src/queue/common/types/QueueDrainReport.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import { runDrainLanes } from '#src/queue/drainLanes/runDrainLanes.ts';
import type { LeftBehindTicket } from '#src/queue/internal/common/types/LeftBehindTicket.ts';
import type { ParkedWork } from '#src/queue/internal/common/types/ParkedWork.ts';
import type { WaveSelection } from '#src/queue/internal/common/types/WaveSelection.ts';
import { settleMergedTrees } from '#src/queue/internal/common/utils/settleMergedTrees.ts';
import type { ShipIntegration } from '#src/ship/common/types/ShipIntegration.ts';
import type { ShipSettings } from '#src/ship/common/types/ShipSettings.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';

interface Params {
	cwd: string;
	/** The coordinator run's own id, forwarded so the ship lane can name the run that took a hold. */
	runId: string;
	/** The holds reconciled once before the parked scan, forwarded unchanged. */
	holds: GateHolds;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	shipSettings: ShipSettings;
	/** The effective config and harness the merge lane's integration step verifies and repairs with. */
	shipIntegration: ShipIntegration;
	/** The harness the wave's naming step spawns, so a queued work order is named the way `work-order new` names one. */
	driver: Driver;
	config: LightsoutConfig;
	/** The process environment the tracker credentials are read from. Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
	defaultBranch: string;
	/** Where the coordinator run's `queue.md` is written. */
	planPath: string;
	/** The opening selection, built from the parked scan and the opening tracker read. */
	first: WaveSelection;
	parked: ParkedWork;
	runWorkOrder: (params: { workOrder: NamedWorkOrder }) => Promise<WorkOrderRunOutcome>;
	/** Runs a task with no other main-checkout git mutation in flight — one chain per drain, created in `runQueue.ts` and threaded down. */
	serializeMainCheckout: <Result>(params: { task: () => Promise<Result> }) => Promise<Result>;
	/** The coordinator run's board, handed to the drain that records into it. */
	board: QueueBoardRecorder;
	onProgress?: (message: string) => void;
}

const toParkedIdentifiers = ({ parked }: { parked: ParkedWork }) => [
	...parked.outcomes.map((outcome) => outcome.ticket.identifier),
	...parked.leftBehind.map((entry) => entry.identifier),
	...parked.merged.map((tree) => tree.ticket.identifier),
];

/**
 * Every identifier a scan offered is recorded as attempted and never offered
 * again, except blocked ones. That is what makes the drain terminate, and why a
 * parked ticket is never re-resumed to re-ask the same question.
 *
 * The report is the final state, not a log. Merged parked trees are settled here
 * because writing tickets to Done needs this function's run lock.
 */
export const drainQueue = async ({
	cwd,
	runId,
	holds,
	settings,
	trackerSettings,
	shipSettings,
	shipIntegration,
	driver,
	config,
	env,
	defaultBranch,
	planPath,
	first,
	parked,
	runWorkOrder,
	serializeMainCheckout,
	board,
	onProgress,
}: Params): Promise<QueueDrainReport> => {
	const leftBehind: LeftBehindTicket[] = [...parked.leftBehind];
	const attempted = new Set<string>(toParkedIdentifiers({ parked }).map((identifier) => identifier.toLowerCase()));

	leftBehind.push(...(await settleMergedTrees({ cwd, config, env, settings, trackerSettings, merged: parked.merged, onProgress })));

	return runDrainLanes({
		cwd,
		runId,
		holds,
		config,
		settings,
		trackerSettings,
		shipSettings,
		shipIntegration,
		driver,
		defaultBranch,
		env,
		planPath,
		first,
		carried: parked.outcomes,
		carriedLeftBehind: leftBehind,
		attempted,
		runWorkOrder,
		serializeMainCheckout,
		board,
		onProgress,
	});
};
