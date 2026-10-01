import { setTimeout as delay } from 'node:timers/promises';
import { loadRunProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunProgressBlock.ts';
import { printRunFamilyScreen } from '#src/cli/internal/common/runStatus/printRunFamilyScreen.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

const settleShip = async ({
	cwd,
	runId,
	rootRunId,
	pollMs,
	ceilingMs,
}: {
	cwd: string;
	runId: string;
	rootRunId: string;
	pollMs: number;
	ceilingMs: number;
}) => {
	const deadline = Date.now() + ceilingMs;
	let awaiting = true;

	while (awaiting && Date.now() < deadline) {
		await delay(pollMs);

		awaiting = (await loadRunProgressBlock({ cwd, runId: rootRunId })).progress.awaitingShip;
	}

	await printRunFamilyScreen({ cwd, runId });
};

interface Params {
	cwd: string;
	/** Any run of the family to follow — the watch paints and judges its root. */
	runId: string;
	/** Milliseconds between repaints. Defaults to the two-minute cadence; a test passes a short one. */
	intervalMs?: number;
	/** Milliseconds between ship-result checks once the run itself has finished. */
	shipPollMs?: number;
	/** How long to wait for a ship result before painting the last frame anyway. */
	shipCeilingMs?: number;
}

/**
 * Every frame is the family screen `status --now` prints, judged by the family
 * root: the root's owner stays live across a phase boundary, so the watch
 * follows a phased plan from phase to phase and ends on the first frame whose
 * family is no longer going.
 *
 * Two minutes is the cadence because the reader is a chat transcript as often
 * as a terminal, and a transcript repainted every few seconds is unreadable.
 *
 * Shipping happens after the pipeline returns, so a passed run still
 * `awaitingShip` gets one more frame once the ship result lands. Only one,
 * because a CI wait is open-ended and a transcript of identical blocks is worse
 * than none.
 */
export const watchRunProgress = async ({ cwd, runId, intervalMs = 120_000, shipPollMs = 10_000, shipCeilingMs = 1_800_000 }: Params): Promise<void> => {
	let last = await printRunFamilyScreen({ cwd, runId });

	while ((last.status === RunStatus.Running || last.status === RunStatus.Pending) && last.live) {
		await delay(intervalMs);
		last = await printRunFamilyScreen({ cwd, runId });
	}

	if (last.awaitingShip && last.status === RunStatus.Passed) {
		await settleShip({ cwd, runId, rootRunId: last.runId, pollMs: shipPollMs, ceilingMs: shipCeilingMs });
	}
};
