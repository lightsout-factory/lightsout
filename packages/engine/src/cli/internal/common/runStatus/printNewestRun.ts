import { printRunFamilyScreen } from '#src/cli/internal/common/runStatus/printRunFamilyScreen.ts';
import { listRuns } from '#src/views/listRuns.ts';

interface Params {
	cwd: string;
}

/**
 * The family screen of the newest run, so a phased coordinator shows its phase
 * sequence and its most recent phase — the same screen a watch paints.
 *
 * @returns the id of the run it printed, or undefined when it printed that there are no runs
 */
export const printNewestRun = async ({ cwd }: Params): Promise<string | undefined> => {
	const newest = (await listRuns({ cwd }))[0]?.runId;

	if (newest === undefined) {
		console.log('no runs found');
		return undefined;
	}

	await printRunFamilyScreen({ cwd, runId: newest });

	return newest;
};
