import { unlink } from 'node:fs/promises';
import { getRunLockPath } from '#src/runState/lock/internal/common/utils/getRunLockPath.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';

interface Params {
	cwd: string;
	runId: string;
}

export const releaseRunLock = async ({ cwd, runId }: Params): Promise<void> => {
	const holder = await readRunLock({ cwd });

	if (!holder || holder.pid !== process.pid || holder.runId !== runId) {
		return;
	}

	await unlink(getRunLockPath({ cwd })).catch(() => undefined);
};
