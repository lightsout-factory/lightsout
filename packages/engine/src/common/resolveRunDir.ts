import { runDirectoryIndex } from '#src/common/constants/runDirectoryIndex/runDirectoryIndex.ts';

interface Params {
	cwd: string;
	/** Full run id, or the shortened eight-character form a report printed. */
	runId: string;
}

/**
 * Searched once per process and remembered: a run sits in its plan's ticket
 * folder or under its owning command, so no path can be joined onto a run id
 * to find one. It creates nothing; `createRun` is the one place that does.
 *
 * @throws {RunNotFoundError} When no run answers to the id, or when a shortened id matches more than one.
 */
export const resolveRunDir = async ({ cwd, runId }: Params): Promise<string> => (await runDirectoryIndex.resolve({ cwd, runId })).runDir;
