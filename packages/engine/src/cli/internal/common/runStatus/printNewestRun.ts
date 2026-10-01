import { printRunFamilyScreen } from '#src/cli/internal/common/runStatus/printRunFamilyScreen.ts';
import type { RunProgress } from '#src/views/common/types/RunProgress.ts';
import { listRuns } from '#src/views/listRuns.ts';

interface Params {
	cwd: string;
}

/**
 * The family screen of the newest run, so a phased coordinator shows its phase
 * sequence and its most recent phase — the same screen a watch paints.
 *
 * @returns the family root's progress, or undefined when there are no runs
 */
export const printNewestRun = async ({ cwd }: Params): Promise<RunProgress | undefined> => {
	const newest = (await listRuns({ cwd }))[0]?.runId;

	if (newest === undefined) {
		console.log('no runs found');
		return undefined;
	}

	return printRunFamilyScreen({ cwd, runId: newest });
};
