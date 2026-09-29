import { setTimeout as delay } from 'node:timers/promises';
import { getRunFamilyRoot } from '#src/cli/internal/common/runFamily/getRunFamilyRoot.ts';
import { groupRunFamilies } from '#src/cli/internal/common/runFamily/groupRunFamilies.ts';
import type { RunFamily } from '#src/cli/internal/common/types/RunFamily.ts';
import type { WatchTarget } from '#src/cli/internal/common/types/WatchTarget.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { listRuns } from '#src/views/listRuns.ts';

const findGoingRuns = async ({ cwd, rootRunId }: { cwd: string; rootRunId?: string }) =>
	(await listRuns({ cwd })).filter(
		(run) => (run.status === RunStatus.Running || run.status === RunStatus.Pending) && (rootRunId === undefined || getRunFamilyRoot({ run }) === rootRunId),
	);

/**
 * Status alone is not enough: a crash leftover `running` manifest beside a
 * freshly started run would make every bare `--watch` ambiguous. Liveness alone
 * is no better: a phased coordinator holds no lock between phases, so its
 * family would drop out in that gap. Hence live families first, all otherwise.
 */
const selectCandidates = ({ families }: { families: RunFamily[] }) => {
	const live = families.filter((family) => family.runs.some((run) => run.live));

	return live.length > 0 ? live : families;
};

interface Params {
	cwd: string;
	/** Follow only this run and the phase children it started. Omitted on the one call made before any run has been chosen. */
	rootRunId?: string;
	/** How long to wait for a run to start before giving up. */
	graceMs?: number;
	pollMs?: number;
}

/**
 * The wait closes a race: the implement skill starts the run in the background
 * and the watch immediately after, and a run that has not yet written its first
 * manifest is invisible, so taking the newest run would attach to the previous
 * one. Two unrelated families going at once are never guessed between.
 */
export const resolveWatchTarget = async ({ cwd, rootRunId, graceMs = 60_000, pollMs = 2_000 }: Params): Promise<WatchTarget | undefined> => {
	const deadline = Date.now() + graceMs;
	let going = await findGoingRuns({ cwd, rootRunId });

	while (going.length === 0 && Date.now() < deadline) {
		await delay(pollMs);
		going = await findGoingRuns({ cwd, rootRunId });
	}

	const candidates = selectCandidates({ families: groupRunFamilies({ runs: going }) });
	const [only] = candidates;
	// `listRuns` answers newest first, so a family's head is the run moving right
	// now: the phase child during a phase, the coordinator in the gap between two.
	const head = only?.runs[0];
	let target: WatchTarget | undefined;

	if (candidates.length > 1) {
		target = { ambiguous: candidates.map((family) => family.root) };
	} else if (only !== undefined && head !== undefined) {
		target = { runId: head.runId, rootRunId: only.root };
	}

	return target;
};
