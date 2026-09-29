import { loadRunProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunProgressBlock.ts';
import type { RunProgress } from '#src/views/common/types/RunProgress.ts';

interface Params {
	cwd: string;
	runId: string;
}

/**
 * A frame is appended and nothing clears the screen, because the implement
 * skill relays this stdout into a chat transcript, where a clear-screen
 * sequence is noise.
 *
 * @throws {RunNotFoundError} When no run on disk answers to the given id.
 */
export const printRunProgress = async ({ cwd, runId }: Params): Promise<RunProgress> => {
	const { progress, lines } = await loadRunProgressBlock({ cwd, runId });

	console.log('');

	for (const line of lines) {
		console.log(line);
	}

	return progress;
};
