import { runDirectoryIndex } from '#src/common/constants/runDirectoryIndex.ts';

interface Params {
	cwd: string;
	runId: string;
}

/**
 * Reports print run ids cut to their first eight characters, so accepting a
 * prefix is what lets `resume --run <id>` take the id its own report showed.
 * Shares one lookup with `resolveRunDir`, so the two never answer from
 * different scans.
 *
 * @throws {RunNotFoundError} When no run answers to the id, or when a shortened id matches more than one.
 */
export const resolveRunId = async ({ cwd, runId }: Params): Promise<string> => (await runDirectoryIndex.resolve({ cwd, runId })).runId;
