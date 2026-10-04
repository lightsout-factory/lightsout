import { messageOf } from '#src/common/messageOf.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { DriverInvocation } from '#src/common/types/DriverInvocation.ts';
import type { DriverResult } from '#src/common/types/DriverResult.ts';
import type { HarnessProcessUsage } from '#src/contracts/activity/HarnessProcessUsage.ts';
import { ProcessEndReason } from '#src/contracts/activity/ProcessEndReason.ts';

interface Params {
	driver: Driver;
	invocation: DriverInvocation;
	/** The level this spawn belongs to. Absent wherever no run is being recorded. */
	activity?: ActivityLevel;
	/** Which spawn of the ladder this is, counting from one and never restarting — the same number the rejected-payload evidence files carry. */
	spawn: number;
	/** Whether this spawn is the cheap re-emit rather than a fresh role attempt. */
	reemit: boolean;
}

/**
 * A rejection is `timed-out` when the elapsed time reached the ceiling this call
 * handed the driver, never by matching the rejection's text.
 *
 * Usage is captured from the stream because a process killed at its ceiling
 * returns no result. A spawn that reported none writes no usage, never a zero
 * indistinguishable from a real one. The same figure is handed back so the
 * caller's total cannot drift from the process mark.
 */
export const recordHarnessProcess = async ({
	driver,
	invocation,
	activity,
	spawn,
	reemit,
}: Params): Promise<{ ok: true; result: DriverResult; usage?: HarnessProcessUsage } | { ok: false; failure: string; usage?: HarnessProcessUsage }> => {
	const startedAt = new Date();
	let streamed: HarnessProcessUsage | undefined;
	let rung: { ok: true; result: DriverResult } | { ok: false; failure: string };
	let endReason: ProcessEndReason;
	let usage: HarnessProcessUsage | undefined;

	try {
		const result = await driver.invoke({
			...invocation,
			onUsage: (reported) => {
				streamed = reported;
			},
		});

		rung = { ok: true, result };
		endReason = result.rateLimited ? ProcessEndReason.RateLimited : ProcessEndReason.Completed;
		usage = result.usage ?? streamed;
	} catch (error) {
		// A step failure the run resumes from, never an uncaught crash that zombies
		// the manifest. No blind retry: a second identical timeout only doubles the cost.
		rung = { ok: false, failure: `agent invocation failed: ${messageOf({ error })}` };
		endReason =
			invocation.timeoutMs !== undefined && Date.now() - startedAt.getTime() >= invocation.timeoutMs ? ProcessEndReason.TimedOut : ProcessEndReason.Failed;
		usage = streamed;
	}

	const endedAt = new Date();

	try {
		activity?.recordProcess({
			harness: driver.name,
			model: invocation.model,
			effort: invocation.effort,
			spawn,
			reemit,
			startedAt: startedAt.toISOString(),
			endedAt: endedAt.toISOString(),
			endReason,
			usage,
		});
	} catch {
		// Evidence never fails the work it describes.
	}

	return { ...rung, usage };
};
