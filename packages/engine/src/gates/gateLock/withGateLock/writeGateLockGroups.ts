import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { readGateLock } from '#src/gates/gateLock/withGateLock/common/readGateLock.ts';

interface Params {
	lockPath: string;
	runId: string;
	/** The whole current set, never a delta, so the last write to land is the correct one. */
	gateGroups: number[];
}

/**
 * A failed write is swallowed: a held reservation must not be dropped over a
 * transient write.
 *
 * The read-then-write needs no file locking: reclaiming requires the holder's
 * pid to be dead, and a dead process runs no group write, so no reclaimer can
 * land between our read and our write.
 */
export const writeGateLockGroups = async ({ lockPath, runId, gateGroups }: Params): Promise<void> => {
	const holder = readGateLock({ lockPath });

	if (!holder || holder.pid !== process.pid || holder.runId !== runId) {
		return;
	}

	// Renamed over the lock so a reader never sees the empty file an in-place
	// rewrite leaves. Synchronous so this process's writes land in the order
	// they were made.
	const tempPath = `${lockPath}.${process.pid}.tmp`;

	try {
		writeFileSync(tempPath, `${JSON.stringify({ ...holder, gateGroups }, null, '\t')}\n`, 'utf8');
		renameSync(tempPath, lockPath);
	} catch {
		rmSync(tempPath, { force: true });
	}
};
