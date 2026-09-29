import { rename, writeFile } from 'node:fs/promises';
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

	await writeFile(tmpPath, `${JSON.stringify(stamped, null, '\t')}\n`, 'utf8');
	await rename(tmpPath, manifestPath);

	return stamped;
};
