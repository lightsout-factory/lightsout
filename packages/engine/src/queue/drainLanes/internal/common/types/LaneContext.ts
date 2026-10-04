import type { Driver } from '#src/common/types/Driver.ts';
import type { GateHolds } from '#src/common/types/GateHolds.ts';
import type { ShipIntegration } from '#src/common/types/ShipIntegration.ts';
import type { ShipSettings } from '#src/common/types/ShipSettings.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { QueueBoardRecorder } from '#src/queue/board/QueueBoardRecorder.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';

export interface LaneContext {
	/** The main repository checkout. */
	cwd: string;
	config: LightsoutConfig;
	/** The coordinator run's own id, so a hold the ship lane takes names the run that took it. */
	runId: string;
	/** The holds reconciled once at the drain's start, read by every re-scan. */
	holds: GateHolds;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	shipSettings: ShipSettings;
	shipIntegration: ShipIntegration;
	/** Threaded rather than taken from `shipIntegration`, whose driver is the merge lane's repair harness. */
	driver: Driver;
	defaultBranch: string;
	env: NodeJS.ProcessEnv;
	/** Where the coordinator run's queue document is written, rewritten every time tickets are admitted. */
	planPath: string;
	runWorkOrder: (params: { workOrder: NamedWorkOrder }) => Promise<WorkOrderRunOutcome>;
	/**
	 * A builder's worktree creation, the merge tail's removal and the re-scan's
	 * removal run concurrently in this drain and must not overlap. Passed in
	 * because the builders' creation already takes the chain `runQueue.ts`
	 * captured in `runWorkOrder`.
	 */
	serializeMainCheckout: <Result>(params: { task: () => Promise<Result> }) => Promise<Result>;
	/** The coordinator run's board. The drain only records a snapshot into it on each pass, and never awaits the write. */
	board: Pick<QueueBoardRecorder, 'record'>;
	onProgress?: (message: string) => void;
}
