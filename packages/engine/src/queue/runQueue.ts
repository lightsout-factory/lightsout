import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { GateHolds } from '#src/gates/gateHolds/common/types/GateHolds.ts';
import { syncGateHolds } from '#src/gates/gateHolds/syncGateHolds.ts';
import { BoardQuestionRelay } from '#src/queue/board/BoardQuestionRelay.ts';
import { QueueBoardRecorder } from '#src/queue/board/QueueBoardRecorder.ts';
import type { QuestionRelay } from '#src/queue/common/types/QuestionRelay.ts';
import type { QueueDrainReport } from '#src/queue/common/types/QueueDrainReport.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { ParkedWork } from '#src/queue/internal/common/types/ParkedWork.ts';
import type { WaveSelection } from '#src/queue/internal/common/types/WaveSelection.ts';
import { createMainCheckoutSerializer } from '#src/queue/internal/common/utils/createMainCheckoutSerializer.ts';
import { startCoordinatorRun } from '#src/queue/internal/common/utils/startCoordinatorRun.ts';
import { toCoordinatorStatus } from '#src/queue/internal/common/utils/toCoordinatorStatus.ts';
import { drainQueue } from '#src/queue/internal/drainQueue.ts';
import { runQueueWorkOrder } from '#src/queue/internal/runQueueWorkOrder.ts';
import { settleEmptyDrain } from '#src/queue/internal/settleEmptyDrain.ts';
import { settleParkedLabels } from '#src/queue/internal/settleParkedLabels.ts';
import { checkQueueStartup } from '#src/queue/startup/checkQueueStartup.ts';
import { listEligibleTickets } from '#src/queue/ticketSelection/listEligibleTickets.ts';
import { orderTickets } from '#src/queue/ticketSelection/orderTickets.ts';
import { selectWaveTickets } from '#src/queue/ticketSelection/selectWaveTickets.ts';
import { scanParkedWorktrees } from '#src/queue/worktrees/scanParkedWorktrees.ts';
import { withRunLock } from '#src/runState/lock/withRunLock.ts';
import { seedUsageTotals } from '#src/runState/seedUsageTotals.ts';
import { writeManifestWithUsage } from '#src/runState/writeManifestWithUsage.ts';
import type { ShipSettings } from '#src/ship/common/types/ShipSettings.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';

interface Params {
	cwd: string;
	/** The id the queue coordinator run is created under, minted by the caller; a fresh one when absent. */
	runId?: string;
	/**
	 * A detached queue's child records its run even when nothing is left to do,
	 * so the launcher's handshake and the saved summary have a run to find. A
	 * foreground drain leaves it off, and an empty drain then creates no run.
	 */
	recordEmptyDrain?: boolean;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	shipSettings: ShipSettings;
	config: LightsoutConfig;
	/** The queue's startup config, as it was read from disk before the command stamped its harness on it, and its path. The coordinator's run and every ticket's runs record this one value, so one queue run keeps one config for every ticket. */
	loadedConfig: LoadedConfig;
	/** The process environment the tracker credentials are read from. Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
	driver: Driver;
	driverName: string;
	relay: QuestionRelay;
	onProgress?: (message: string) => void;
}

const drainAndShip = async ({
	cwd,
	runId,
	settings,
	trackerSettings,
	shipSettings,
	config,
	loadedConfig,
	env,
	driver,
	driverName,
	relay,
	defaultBranch,
	first,
	parked,
	holds,
	onProgress,
}: Params & { runId: string; defaultBranch: string; first: WaveSelection; parked: ParkedWork; holds: GateHolds }) => {
	const { coordinatorRunDir, planPath, manifest } = await startCoordinatorRun({ cwd, runId, driverName, loadedConfig });

	// One chain per drain, threaded to everything that mutates the main checkout:
	// the builders' `git worktree add`, the merge tail's removal and the re-scan's.
	const serializeMainCheckout = createMainCheckoutSerializer();
	const board = new QueueBoardRecorder({ cwd, runId, onProgress });
	// Workers ask through this, so an open question shows on the board; delivery stays the CLI relay's.
	const boardRelay = new BoardQuestionRelay({ relay, board });
	const drained = await drainQueue({
		cwd,
		runId,
		holds,
		settings,
		trackerSettings,
		shipSettings,
		// The effective config and resolved harness, so the merge lane's
		// integration step recovers with exactly what the builders were given.
		shipIntegration: { config, driver },
		driver,
		config,
		env,
		defaultBranch,
		planPath,
		first,
		parked,
		serializeMainCheckout,
		board,
		onProgress,
		runWorkOrder: ({ workOrder }) =>
			runQueueWorkOrder({
				cwd,
				settings,
				trackerSettings,
				workOrder,
				config,
				loadedConfig,
				driver,
				driverName,
				defaultBranch,
				env,
				relay: boardRelay,
				serializeWorktreeAdd: serializeMainCheckout,
				coordinatorRunId: runId,
				coordinatorRunDir,
				onProgress: relay.createProgressSink({ ticket: workOrder.ticket }),
			}),
	});
	const status = toCoordinatorStatus({ drained });

	// One call is the whole park/ship label story: shipping has already flipped
	// `ready` on anything it could not merge, so a ship-step park is labelled by
	// the same line that labels a worker park.
	await settleParkedLabels({ settings, trackerSettings, outcomes: drained.outcomes, onProgress });
	// The last board write lands before the run records its final status.
	await board.flush();
	await writeManifestWithUsage({ cwd, manifest, patch: { status, currentStep: null }, usageTotals: seedUsageTotals({ usage: manifest.usage }) });

	return drained;
};

/**
 * Parked runs come first because a restart is the resume path: their tickets
 * sit at the in-progress status the eligible query cannot see, so they are
 * found on disk. The run lock makes two concurrent `lightsout queue`
 * invocations impossible; each worker takes its own lock in its own worktree,
 * so the two never contend.
 */
export const runQueue = async ({
	cwd,
	runId,
	recordEmptyDrain,
	settings,
	trackerSettings,
	shipSettings,
	config,
	loadedConfig,
	env,
	driver,
	driverName,
	relay,
	onProgress,
}: Params): Promise<QueueDrainReport | QueueFailure> => {
	const started = await checkQueueStartup({ cwd, settings, trackerSettings, shipSettings });

	if ('error' in started) {
		return started;
	}

	const { defaultBranch } = started;
	const eligible = await listEligibleTickets({ settings, trackerSettings });

	if ('error' in eligible) {
		return eligible;
	}

	// Once per drain, and before the parked scan: the scan is the first site that
	// would otherwise clear a held ticket's parked label. A hold taken while this
	// drain runs belongs to a ticket already attempted and never re-offered, so a
	// snapshot misses nothing this drain could act on.
	const holds = await syncGateHolds({ cwd, settings: trackerSettings, onProgress });
	const parked = await scanParkedWorktrees({ cwd, defaultBranch, settings, trackerSettings, holds, onProgress });

	if ('error' in parked) {
		return parked;
	}

	const first = selectWaveTickets({
		tickets: [...parked.resumed, ...orderTickets({ tickets: eligible })],
		settings,
		attempted: new Set<string>(),
		holds,
		onProgress,
	});

	if (first.runnable.length === 0 && parked.outcomes.length === 0 && parked.merged.length === 0) {
		return settleEmptyDrain({ cwd, runId, recordEmptyDrain, driverName, loadedConfig, first, parked, onProgress });
	}

	return withRunLock({
		params: { cwd, runId, onProgress },
		run: ({ runId: lockedRunId }) =>
			drainAndShip({
				cwd,
				runId: lockedRunId,
				settings,
				trackerSettings,
				shipSettings,
				config,
				loadedConfig,
				env,
				driver,
				driverName,
				relay,
				defaultBranch,
				first,
				parked,
				holds,
				onProgress,
			}),
	});
};
