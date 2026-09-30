import { formatShortRunId } from '@lightsout/shared';
import type { RunLock } from '#src/contracts/run/RunLock.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { buildCleanupSummary } from '#src/runState/common/utils/buildCleanupSummary.ts';
import { isRunLive } from '#src/runState/isRunLive.ts';
import { readLastProgressMessage } from '#src/runState/progress/readLastProgressMessage.ts';
import { readShipResult } from '#src/ship/readShipResult.ts';
import type { RunProgress } from '#src/views/common/types/RunProgress.ts';
import type { RunProgressRow } from '#src/views/common/types/RunProgressRow.ts';
import { getRunTitle } from '#src/views/internal/common/utils/getRunTitle.ts';

/** Statuses from which this run can still reach ship — a run that ended any other way never will. */
const shippableStatuses: RunStatus[] = [RunStatus.Running, RunStatus.Pending, RunStatus.PausedRateLimit, RunStatus.PausedBudget, RunStatus.Passed];

const shipRowStatus: Record<ShipStatus, RunStatus> = {
	[ShipStatus.Shipped]: RunStatus.Passed,
	[ShipStatus.Blocked]: RunStatus.Failed,
};

const readShipRow = async ({ cwd, manifest }: { cwd: string; manifest: RunManifest }): Promise<RunProgressRow> => {
	const result = manifest.branch === undefined ? undefined : await readShipResult({ cwd, branch: manifest.branch });

	return {
		id: 'ship',
		status: result && shipRowStatus[result.status],
		attempts: result === undefined ? 0 : 1,
		durationMs: undefined,
		verification: undefined,
		cleanup: undefined,
	};
};

interface Params {
	cwd: string;
	manifest: RunManifest;
	/** Decides whether a running row ticks. */
	lock: RunLock | undefined;
}

/**
 * A long step writes nothing while it works, so the running step of a live run
 * adds the time since the manifest's last write. A run with no process behind it
 * does not tick, because a crashed run that kept ticking would read as work.
 */
export const getRunProgress = async ({ cwd, manifest, lock }: Params): Promise<RunProgress> => {
	const live = isRunLive({ manifest, lock });
	const sinceWriteMs = live ? Math.max(0, Date.now() - Date.parse(manifest.updatedAt)) : 0;
	const rows: RunProgressRow[] = manifest.steps.map((step) => ({
		id: step.id,
		status: step.status,
		attempts: step.attempts,
		durationMs: step.status === RunStatus.Running ? (step.durationMs ?? 0) + sinceWriteMs : step.durationMs,
		verification: step.verification,
		cleanup: buildCleanupSummary({ step }),
	}));
	const recorded = new Set(rows.map((row) => row.id));

	// Only a pipeline that declared its sequence gets pending rows. Refactor,
	// coverage and phases discover their work as they go, and a guessed row is
	// worse than none.
	for (const id of manifest.stepOrder ?? []) {
		if (!recorded.has(id)) {
			rows.push({ id, status: undefined, attempts: 0, durationMs: undefined, verification: undefined, cleanup: undefined });
		}
	}

	// A run that ended failed or escalated will never ship, so a pending ship row
	// would promise work still to come.
	const shipRow = manifest.willShip === true && shippableStatuses.includes(manifest.status) ? await readShipRow({ cwd, manifest }) : undefined;

	if (shipRow) {
		rows.push(shipRow);
	}

	return {
		runId: manifest.runId,
		shortId: formatShortRunId({ runId: manifest.runId }),
		title: getRunTitle({ plan: manifest.plan }),
		status: manifest.status,
		live,
		rows,
		elapsedMs: Math.max(0, Date.parse(manifest.updatedAt) - Date.parse(manifest.createdAt)) + sinceWriteMs,
		changedFileCount: manifest.changedFiles.length,
		costUsd: manifest.usage?.costUsd,
		now: await readLastProgressMessage({ cwd, runId: manifest.runId }),
		awaitingShip: shipRow !== undefined && shipRow.status === undefined,
	};
};
