import { printRunProgress } from '#src/cli/internal/common/render/printRunProgress.ts';
import { listRuns } from '#src/views/listRuns.ts';

interface Params {
	cwd: string;
}

/**
 * One block, never a family pair, even for a phased coordinator: the bare
 * `--watch` path falls back here too, and what `--watch` shows is settled.
 */
export const printNewestRun = async ({ cwd }: Params): Promise<void> => {
	const newest = (await listRuns({ cwd }))[0]?.runId;

	if (newest === undefined) {
		console.log('no runs found');
		return;
	}

	await printRunProgress({ cwd, runId: newest });
};
