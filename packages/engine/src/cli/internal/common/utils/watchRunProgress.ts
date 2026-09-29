import { setTimeout as delay } from 'node:timers/promises';
import { printRunProgress } from '#src/cli/internal/common/render/printRunProgress.ts';
import { resolveWatchTarget } from '#src/cli/internal/common/utils/resolveWatchTarget.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { readRunProcessLock } from '#src/runState/lock/readRunProcessLock.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import type { RunProgress } from '#src/views/common/types/RunProgress.ts';
import { getRunProgress } from '#src/views/getRunProgress.ts';

const settleShip = async ({ cwd, runId, pollMs, ceilingMs }: { cwd: string; runId: string; pollMs: number; ceilingMs: number }) => {
	const deadline = Date.now() + ceilingMs;
	let awaiting = true;

	while (awaiting && Date.now() < deadline) {
		await delay(pollMs);

		const manifest = await readRunManifest({ cwd, runId });
		const lock = await readRunProcessLock({ cwd, manifest });

		awaiting = (await getRunProgress({ cwd, manifest, lock })).awaitingShip;
	}

	await printRunProgress({ cwd, runId });
};

interface Params {
	cwd: string;
	/** The run to follow, fixed. */
	runId?: string;
	/** Follow mode: re-resolve the target inside this run's family every frame. */
	rootRunId?: string;
	/** Milliseconds between repaints. Defaults to the two-minute cadence; a test passes a short one. */
	intervalMs?: number;
	/** How long follow mode waits for the next run to appear at a phase boundary. */
	handoffMs?: number;
	/** Milliseconds between ship-result checks once the run itself has finished. */
	shipPollMs?: number;
	/** How long to wait for a ship result before painting the last frame anyway. */
	shipCeilingMs?: number;
}

/**
 * Follow mode (`rootRunId`) re-resolves the going run of the family every
 * frame, which is what makes a phased plan watchable: during a phase the child
 * is the more recently updated manifest, between phases only the coordinator is
 * going. Fixing on one run would end the watch at the first phase boundary.
 *
 * Two minutes is the cadence because the reader is a chat transcript as often
 * as a terminal, and a transcript repainted every few seconds is unreadable.
 *
 * Shipping happens after the pipeline returns, so a passed run still
 * `awaitingShip` gets one more frame once the ship result lands. Only one,
 * because a CI wait is open-ended and a transcript of identical blocks is worse
 * than none.
 */
export const watchRunProgress = async ({
	cwd,
	runId,
	rootRunId,
	intervalMs = 120_000,
	handoffMs = 10_000,
	shipPollMs = 10_000,
	shipCeilingMs = 1_800_000,
}: Params): Promise<void> => {
	// Two consecutive frames with no live process behind the run end it. One is
	// not enough: a phased coordinator holds no lock between phases.
	const deadFrameCeiling = 2;
	let deadFrames = 0;
	let watching = true;
	let last: RunProgress | undefined;

	while (watching) {
		// A short grace: the long wait covers a just-started run before the watch
		// starts, and inside the loop it would only delay the exit.
		const resolved = runId !== undefined || rootRunId === undefined ? undefined : await resolveWatchTarget({ cwd, rootRunId, graceMs: handoffMs });
		// A family is one choice, so the resolver cannot answer ambiguous here;
		// the branch is what keeps that true rather than assumed.
		const target = runId ?? (resolved !== undefined && 'runId' in resolved ? resolved.runId : undefined);

		if (target === undefined) {
			break;
		}

		last = await printRunProgress({ cwd, runId: target });
		deadFrames = last.live ? 0 : deadFrames + 1;
		watching = (last.status === RunStatus.Running || last.status === RunStatus.Pending) && deadFrames < deadFrameCeiling;

		if (watching) {
			await delay(intervalMs);
		}
	}

	if (last?.awaitingShip === true && last.status === RunStatus.Passed) {
		await settleShip({ cwd, runId: last.runId, pollMs: shipPollMs, ceilingMs: shipCeilingMs });
	}
};
