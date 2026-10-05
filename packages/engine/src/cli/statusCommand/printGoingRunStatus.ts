import { printAmbiguousRuns } from '#src/cli/statusCommand/common/printAmbiguousRuns.ts';
import { printNewestRun } from '#src/cli/statusCommand/common/printNewestRun.ts';
import { printRunFamilyScreen } from '#src/cli/statusCommand/common/printRunFamilyScreen/printRunFamilyScreen.ts';
import { printRunFinalReport } from '#src/cli/statusCommand/common/printRunFinalReport.ts';
import { resolveWatchTarget } from '#src/cli/statusCommand/common/resolveWatchTarget/resolveWatchTarget.ts';
import { usage } from '#src/common/constants/usage.ts';

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
		const newest = await printNewestRun({ cwd });

		if (newest !== undefined) {
			await printRunFinalReport({ cwd, runId: newest });
		}
	} else {
		// The family HEAD the resolver answered, not its root: the loader climbs,
		// and climbing is where the guard against an unreadable coordinator lives.
		await printRunFamilyScreen({ cwd, runId: going.runId });
	}

	return code;
};
