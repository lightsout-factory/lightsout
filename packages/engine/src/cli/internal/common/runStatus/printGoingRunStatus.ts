import { usage } from '#src/cli/common/constants/usage.ts';
import { printAmbiguousRuns } from '#src/cli/internal/common/runStatus/printAmbiguousRuns.ts';
import { printNewestRun } from '#src/cli/internal/common/runStatus/printNewestRun.ts';
import { printRunFamilyScreen } from '#src/cli/internal/common/runStatus/printRunFamilyScreen.ts';
import { resolveWatchTarget } from '#src/cli/internal/common/utils/resolveWatchTarget.ts';

interface Params {
	cwd: string;
	/** The flags the reader typed, so this form refuses its own contradictions. */
	flags: Map<string, string | true>;
}

/**
 * No grace period: the minute `--watch` waits exists for a caller that has just
 * started a run in the background, and a person typing this form has not.
 */
export const printGoingRunStatus = async ({ cwd, flags }: Params): Promise<number> => {
	if (flags.get('now') !== true || flags.has('run') || flags.has('watch') || flags.has('planning') || flags.has('shipping')) {
		console.error(usage);
		return 1;
	}

	const going = await resolveWatchTarget({ cwd, graceMs: 0 });
	let code = 0;

	if (going !== undefined && 'ambiguous' in going) {
		printAmbiguousRuns({ roots: going.ambiguous });
		code = 1;
	} else if (going === undefined) {
		await printNewestRun({ cwd });
	} else {
		// The family HEAD the resolver answered, not its root: the loader climbs,
		// and climbing is where the guard against an unreadable coordinator lives.
		await printRunFamilyScreen({ cwd, runId: going.runId });
	}

	return code;
};
