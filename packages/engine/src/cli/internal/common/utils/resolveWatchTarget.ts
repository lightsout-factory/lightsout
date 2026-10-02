import { setTimeout as delay } from 'node:timers/promises';
import { groupRunFamilies } from '#src/cli/internal/common/runFamily/groupRunFamilies.ts';
import type { WatchTarget } from '#src/cli/internal/common/types/WatchTarget.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { listRuns } from '#src/views/listRuns.ts';

/**
 * Status alone is not enough: a crash leftover `running` manifest beside a
 * freshly started run would make every bare `--watch` ambiguous. The owner
 * record keeps a phased family live across the gap between its phases, so a
 * run with no live process behind it is simply never the going run.
 */
const findGoingRuns = async ({ cwd }: { cwd: string }) =>
	(await listRuns({ cwd })).filter((run) => (run.status === RunStatus.Running || run.status === RunStatus.Pending) && run.live);

interface Params {
	cwd: string;
	/** How long to wait for a run to start before giving up. */
	graceMs?: number;
	pollMs?: number;
}

/**
 * The wait closes a race: a caller that has just started a run in the
 * background watches immediately after, and a run that has not yet written its
 * first manifest is invisible, so taking the newest run would attach to the
 * previous one. Two unrelated families going at once are never guessed between.
 */
export const resolveWatchTarget = async ({ cwd, graceMs = 60_000, pollMs = 2_000 }: Params): Promise<WatchTarget | undefined> => {
	const deadline = Date.now() + graceMs;
	let going = await findGoingRuns({ cwd });

	while (going.length === 0 && Date.now() < deadline) {
		await delay(pollMs);
		going = await findGoingRuns({ cwd });
	}

	const families = groupRunFamilies({ runs: going });
	const [only] = families;
	// `listRuns` answers newest first, so a family's head is the run moving right
	// now: the phase child during a phase, the coordinator in the gap between two.
	const head = only?.runs[0];
	let target: WatchTarget | undefined;

	if (families.length > 1) {
		target = { ambiguous: families.map((family) => family.root) };
	} else if (only !== undefined && head !== undefined) {
		target = { runId: head.runId, rootRunId: only.root };
	}

	return target;
};
