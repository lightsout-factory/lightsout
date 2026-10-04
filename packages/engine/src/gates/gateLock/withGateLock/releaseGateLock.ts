import { unlink } from 'node:fs/promises';
import { readGateLock } from '#src/gates/gateLock/withGateLock/common/readGateLock.ts';

interface Params {
	lockPath: string;
	runId: string;
}

/** Only our own reservation, so a reclaim is never undone by the run it replaced. */
export const releaseGateLock = async ({ lockPath, runId }: Params): Promise<void> => {
	const holder = readGateLock({ lockPath });

	if (!holder || holder.pid !== process.pid || holder.runId !== runId) {
		return;
	}

	await unlink(lockPath).catch(() => undefined);
};
