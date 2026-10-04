import { remoteWaitTimings } from '#src/ship/common/constants/remoteWaitTimings.ts';
import { hasNoChecks } from '#src/ship/common/hasNoChecks.ts';
import { sleep } from '#src/ship/common/sleep.ts';
import type { ChecksSummary } from '#src/ship/common/types/ChecksSummary.ts';
import { readPullRequestChecks } from '#src/ship/forge/readPullRequestChecks.ts';

interface Params {
	prNumber: number;
	cwd: string;
	/** Resolved once at the edge: whether this repository has explicitly said it has no CI. */
	allowNoCi: boolean;
	/** The exact candidate commit this attempt pushed — the only commit whose checks may count. */
	expectedHead: string;
	onProgress?: (message: string) => void;
}

/**
 * An unreadable poll is retried rather than failed, and a run of them ends at the ceiling with
 * `readable: false`, so the caller reports a timeout rather than claiming there is no CI. An empty
 * list is never a pass on its own: seconds after a pull request opens, no checks looks exactly
 * like CI that has not registered yet.
 */
export const waitForChecks = async ({ prNumber, cwd, allowNoCi, expectedHead, onProgress }: Params): Promise<ChecksSummary> => {
	const { pollIntervalMs, ceilingMs } = remoteWaitTimings;
	const emptyGraceMs = 60_000;
	const startedAt = Date.now();

	let summary: ChecksSummary = { finished: false, green: false, failing: [], pending: [], passing: [], readable: false };
	let readable = false;
	let announcedEmpty = false;
	let waiting = true;

	while (waiting) {
		const polled = await readPullRequestChecks({ prNumber, cwd, expectedHead });

		readable = polled !== undefined;

		if (polled !== undefined) {
			summary = polled;
			onProgress?.(`checks: ${polled.passing.length} passed, ${polled.pending.length} running, ${polled.failing.length} failed`);
		}

		const elapsedMs = Date.now() - startedAt;
		const empty = polled !== undefined && hasNoChecks({ summary: polled });

		if (empty && !allowNoCi && !announcedEmpty) {
			announcedEmpty = true;
			onProgress?.('checks: the forge lists none for this commit — ship requires CI, so it waits for them to register');
		}

		// An empty list settles only for a repository that opted out, and only
		// once the registration grace has passed.
		const held = empty && (!allowNoCi || elapsedMs < emptyGraceMs);

		if (polled?.finished === true && !held) {
			waiting = false;
		} else if (elapsedMs >= ceilingMs) {
			summary = { ...summary, finished: false };
			waiting = false;
		} else {
			await sleep({ ms: pollIntervalMs });
		}
	}

	return { ...summary, readable };
};
