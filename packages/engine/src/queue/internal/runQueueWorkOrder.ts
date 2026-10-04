import { join } from 'node:path';
import { TrackerStatusRole } from '#src/common/constants/TrackerStatusRole.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { BranchPhase } from '#src/contracts/queue/BranchPhase.ts';
import { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import { readBranchState } from '#src/queue/branchState/readBranchState.ts';
import { writeBranchState } from '#src/queue/branchState/writeBranchState.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { QuestionRelay } from '#src/queue/common/types/QuestionRelay.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import type { RunnableTicket } from '#src/queue/internal/common/types/RunnableTicket.ts';
import { settleWorkerOutcome } from '#src/queue/internal/common/utils/settleWorkerOutcome.ts';
import { runWorkerWithRelay } from '#src/queue/workers/runWorkerWithRelay.ts';
import { updateTicketLifecycle } from '#src/ticketLifecycle/updateTicketLifecycle.ts';
import { createWorktree } from '#src/worktree/createWorktree.ts';
import { resolveWorktreePath } from '#src/worktree/resolveWorktreePath.ts';

interface Params {
	/** The main repository checkout. */
	cwd: string;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	/** The work order this run builds: its ticket, its label, and the branch its record stores. */
	workOrder: NamedWorkOrder;
	config: LightsoutConfig;
	/** The queue's startup config as it was read from disk, and its path, which every run this ticket creates records. */
	loadedConfig: LoadedConfig;
	driver: Driver;
	/** Recorded on the worker's manifest as the harness name. */
	driverName: string;
	/** The default branch, read once by the queue. */
	defaultBranch: string;
	/** The process environment the tracker credentials are read from. Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
	relay: QuestionRelay;
	/** Queue-owned serializer wrapping every `git worktree add` in the main checkout — one chain built by the drain, shared by all tickets. */
	serializeWorktreeAdd: <Result>(params: { task: () => Promise<Result> }) => Promise<Result>;
	/** The coordinator run's id, stamped on every relayed question and answer. */
	coordinatorRunId: string;
	/** The coordinator run's own folder under the queue command's runs folder in the main checkout — where the relay records Q&A, and where this ticket's commit message is written. */
	coordinatorRunDir: string;
	onProgress?: (message: string) => void;
}

// `building` is the opening state, not a reset: writing it over a branch recorded
// `ready` and then failing would send the next run to rebuild finished work.
const recordPickup = async ({ cwd, branch, onProgress }: { cwd: string; branch: string; onProgress?: (message: string) => void }) => {
	if ((await readBranchState({ cwd, branch })) === undefined) {
		await writeBranchState({ cwd, branch, phase: BranchPhase.Building, onProgress });
	}
};

/**
 * Creation is the one step that mutates the main checkout, so it alone goes
 * through the shared chain. The owner makes a tree a standalone run made come back
 * as a creation failure rather than a tree to run a worker in.
 */
const createTicketWorktree = ({
	cwd,
	branch,
	defaultBranch,
	setup,
	serializeWorktreeAdd,
	onProgress,
}: {
	cwd: string;
	branch: string;
	defaultBranch: string;
	setup: QueueSettings['setup'];
	serializeWorktreeAdd: Params['serializeWorktreeAdd'];
	onProgress?: (message: string) => void;
}) =>
	serializeWorktreeAdd({
		task: () => createWorktree({ cwd, branch, startPoint: `origin/${defaultBranch}`, setup, owner: WorktreeOwner.Queue, reuseExisting: true, onProgress }),
	});

/**
 * Made before the worker starts, so a tracker that cannot record it stops the
 * ticket before any source work. The planning status is deliberately not written:
 * the parked scan re-reads it to know which worker to resume.
 */
const claimOwnership = async ({ settings, trackerSettings, ticket }: { settings: QueueSettings; trackerSettings: TrackerSettings; ticket: RunnableTicket }) => {
	const inProgress = settings.lifecycle.statusNames[TrackerStatusRole.InProgress];
	const moved = await updateTicketLifecycle({
		lifecycle: settings.lifecycle,
		trackerSettings,
		ticketId: ticket.id,
		trackerStatus: TrackerStatusRole.InProgress,
		currentStatus: ticket.status,
	});

	return moved === undefined ? undefined : `the ticket status could not be moved to '${inProgress}', so no source work began: ${moved.error}`;
};

/**
 * It deliberately does not ship: the queue merges ready branches serially, and a
 * worker shipping itself would race that order. The worktree is never removed
 * here: a parked tree is the evidence a human needs.
 */
export const runQueueWorkOrder = async ({
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
	relay,
	serializeWorktreeAdd,
	coordinatorRunId,
	coordinatorRunDir,
	onProgress,
}: Params): Promise<WorkOrderRunOutcome> => {
	const { ticket, name, branch } = workOrder;
	const workOrderRunDir = join(coordinatorRunDir, 'work-orders', ticket.identifier);
	const created = await createTicketWorktree({ cwd, branch, defaultBranch, setup: settings.setup, serializeWorktreeAdd, onProgress });

	if (typeof created !== 'string') {
		return { ticket, name, branch, worktreePath: await resolveWorktreePath({ cwd, branch }), ready: false, error: created.error };
	}

	const worktreePath = created;

	await recordPickup({ cwd, branch, onProgress });

	const unclaimed = await claimOwnership({ settings, trackerSettings, ticket });

	if (unclaimed !== undefined) {
		return { ticket, name, branch, worktreePath, ready: false, error: unclaimed };
	}

	const worked = await runWorkerWithRelay({
		worktreePath,
		ticket,
		workOrderName: name,
		config,
		loadedConfig,
		driver,
		driverName,
		settings,
		relay,
		coordinatorRunId,
		coordinatorRunDir,
		workOrderRunDir,
		env,
		onProgress,
	});

	const settled = await settleWorkerOutcome({
		cwd,
		worktreePath,
		branch,
		defaultBranch,
		ticket,
		workOrderRunDir,
		config,
		driver,
		coordinatorRunId,
		worked,
		onProgress,
	});

	return { ticket, name, branch, worktreePath, ...settled };
};
