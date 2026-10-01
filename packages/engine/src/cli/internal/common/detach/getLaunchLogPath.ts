import { join } from 'node:path';
import { resolveSharedStateDir } from '#src/common/workspace/resolveSharedStateDir.ts';

interface Params {
	/** The launching checkout — a primary checkout or a linked worktree of one. */
	cwd: string;
	runId: string;
}

/**
 * One log per run id, kept like a run folder: a resume appends to the same
 * file. In the primary checkout's state dir, so a log is found from any
 * checkout of the repository.
 */
export const getLaunchLogPath = async ({ cwd, runId }: Params): Promise<string> => {
	return join(await resolveSharedStateDir({ cwd }), 'launches', `${runId}.log`);
};
