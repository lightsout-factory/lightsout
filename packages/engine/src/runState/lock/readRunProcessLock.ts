import { stat } from 'node:fs/promises';
import type { RunLock } from '#src/contracts/run/RunLock.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';

interface Params {
	/** The checkout the reader was launched from — where the run's records live. */
	cwd: string;
	/** The run whose holder is wanted; its recorded `workspace` is where its lock is. */
	manifest: RunManifest;
}

/**
 * The run lock is per-checkout, so an isolated run locks its workspace while
 * its manifest lives in the launching checkout; asking the reader's own
 * checkout would brand every healthy isolated run a crash leftover. A workspace
 * that has since been removed falls back to `cwd` rather than failing.
 */
export const readRunProcessLock = async ({ cwd, manifest }: Params): Promise<RunLock | undefined> => {
	const { workspace } = manifest;
	const recorded =
		workspace === undefined
			? undefined
			: await stat(workspace).then(
					(entry) => (entry.isDirectory() ? workspace : undefined),
					() => undefined,
				);

	return readRunLock({ cwd: recorded ?? cwd });
};
