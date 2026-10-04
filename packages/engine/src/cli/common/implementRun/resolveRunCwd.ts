import { stat } from 'node:fs/promises';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';

interface Params {
	/** The checkout the command was launched from — where the run's records live. */
	cwd: string;
	/** The run's manifest, already read from `cwd`. */
	manifest: RunManifest;
}

/**
 * A recorded workspace that has gone is an error rather than a fall back to the
 * launching checkout, which would gate and commit a tree the run was never
 * building in.
 */
export const resolveRunCwd = async ({ cwd, manifest }: Params): Promise<{ workspace: string } | { error: string }> => {
	const { workspace } = manifest;

	if (workspace === undefined) {
		return { workspace: cwd };
	}

	const isDirectory = await stat(workspace).then(
		(entry) => entry.isDirectory(),
		() => false,
	);

	return isDirectory ? { workspace } : { error: `run ${manifest.runId} recorded its workspace at ${workspace}, and there is no checkout there any more` };
};
