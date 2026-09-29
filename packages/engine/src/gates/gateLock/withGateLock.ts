import { randomUUID } from 'node:crypto';
import { describeGateCoordinationTimeout } from '#src/gates/common/utils/describeGateCoordinationTimeout.ts';
import type { GateLockOutcome } from '#src/gates/gateLock/common/types/GateLockOutcome.ts';
import { acquireGateLock } from '#src/gates/gateLock/internal/acquireGateLock.ts';
import { gateLockTimings } from '#src/gates/gateLock/internal/common/constants/gateLockTimings.ts';
import { describeGateLockHolder } from '#src/gates/gateLock/internal/common/utils/describeGateLockHolder.ts';
import { getGateLockPath } from '#src/gates/gateLock/internal/common/utils/getGateLockPath.ts';
import { writeGateLockGroups } from '#src/gates/gateLock/internal/common/utils/writeGateLockGroups.ts';
import { releaseGateLock } from '#src/gates/gateLock/internal/releaseGateLock.ts';
import { describeGateLockFailure } from '#src/gates/internal/common/utils/describeGateLockFailure.ts';

interface Params<Result> {
	cwd: string;
	runId?: string;
	/** `gateLockTimings.waitCeilingMs` when absent; zero means one attempt and no wait. */
	waitCeilingMs?: number;
	onProgress?: (message: string) => void;
	run: (handle: { onGateSpawn: ({ pid }: { pid: number }) => void; onGateExit: ({ pid }: { pid: number }) => void }) => Promise<Result>;
}

/**
 * Unlike `withRunLock`, this waits for a live holder rather than failing fast.
 * A write failure gets its own refusal sentence, so a read-only disk never
 * tells an operator to wait for a run that does not exist.
 *
 * The path is resolved once because resolving it asks git, and polling would
 * otherwise spawn a `git rev-parse` every two seconds on the machine this lock
 * exists to unload.
 *
 * Lock ordering: the reservation is never held past the body it wraps, and
 * nothing inside the body acquires another lock.
 */
export const withGateLock = async <Result>({ cwd, runId, waitCeilingMs, onProgress, run }: Params<Result>): Promise<GateLockOutcome<Result>> => {
	const lockPath = await getGateLockPath({ cwd });
	const heldRunId = runId ?? randomUUID();
	const acquisition = await acquireGateLock({
		lockPath,
		cwd,
		runId: heldRunId,
		waitCeilingMs: waitCeilingMs ?? gateLockTimings.waitCeilingMs,
		onProgress,
	});

	if (!acquisition.acquired) {
		return {
			coordination:
				acquisition.failure === undefined
					? describeGateCoordinationTimeout({ holder: describeGateLockHolder({ lock: acquisition.holder }), waitedMs: acquisition.waitedMs })
					: describeGateLockFailure({ failure: acquisition.failure }),
		};
	}

	const gateGroups = new Set<number>();
	// Package groups spawn and exit in the same tick, so writes are serialised
	// and each carries the whole live set: the last write to land is the truth.
	let persisted = Promise.resolve();
	const persist = () => {
		persisted = persisted.then(() => writeGateLockGroups({ lockPath, runId: heldRunId, gateGroups: [...gateGroups] }));
	};

	try {
		const held = await run({
			onGateSpawn: ({ pid }) => {
				gateGroups.add(pid);
				persist();
			},
			onGateExit: ({ pid }) => {
				gateGroups.delete(pid);
				persist();
			},
		});

		return { held };
	} finally {
		await persisted;
		await releaseGateLock({ lockPath, runId: heldRunId });
	}
};
