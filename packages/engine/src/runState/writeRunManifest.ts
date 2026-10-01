import { rename } from 'node:fs/promises';
import { writeJsonFile } from '#src/common/utils/writeJsonFile.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { getRunManifestPath } from '#src/runState/internal/common/paths/getRunManifestPath.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
}

/** Atomic (tmp file + rename): the resume path depends on this file always being valid JSON. */
export const writeRunManifest = async ({ cwd, manifest }: Params): Promise<RunManifest> => {
	const stamped: RunManifest = { ...manifest, updatedAt: new Date().toISOString() };
	const manifestPath = await getRunManifestPath({ cwd, runId: manifest.runId });
	const tmpPath = `${manifestPath}.tmp`;

	await writeJsonFile({ path: tmpPath, value: stamped });
	await rename(tmpPath, manifestPath);

	return stamped;
};
