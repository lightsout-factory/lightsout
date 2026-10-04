import { join } from 'node:path';
import { resolveRunDir } from '#src/common/resolveRunDir.ts';

interface Params {
	cwd: string;
	runId: string;
}

/** @throws {RunNotFoundError} When no run folder answers to `runId` yet */
export const getRunOwnerPath = async ({ cwd, runId }: Params): Promise<string> => {
	return join(await resolveRunDir({ cwd, runId }), 'owner.json');
};
