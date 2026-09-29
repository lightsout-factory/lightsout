import { readFile } from 'node:fs/promises';
import { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { getRunManifestPath } from '#src/runState/internal/common/paths/getRunManifestPath.ts';

interface Params {
	cwd: string;
	runId: string;
}

/** The run's directory is resolved first, so a run answers to the shortened id its report printed. */
export const readRunManifest = async ({ cwd, runId }: Params): Promise<RunManifest> => {
	const raw = await readFile(await getRunManifestPath({ cwd, runId }), 'utf8');

	return RunManifest.parse(JSON.parse(raw));
};
