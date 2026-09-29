import { join } from 'node:path';
import { resolveRunDir } from '#src/runState/common/paths/resolveRunDir.ts';

interface Params {
	cwd: string;
	runId: string;
}

export const getRunManifestPath = async ({ cwd, runId }: Params): Promise<string> => join(await resolveRunDir({ cwd, runId }), 'manifest.json');
