import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isPidAlive } from '#src/runState/isPidAlive.ts';
import { getRunLockPath } from '#src/runState/lock/common/getRunLockPath.ts';
import { describeRunLockHolder } from '#src/runState/lock/describeRunLockHolder.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';

interface Params {
	cwd: string;
	runId: string;
}

/**
 * An exclusive create (`wx`), so two simultaneous starts never both win. A
 * holder whose pid is dead, or a lock that won't parse, is a crash leftover and
 * is stolen.
 */
export const acquireRunLock = async ({ cwd, runId }: Params): Promise<{ stalePid: number | undefined }> => {
	const lockPath = getRunLockPath({ cwd });
	const payload = `${JSON.stringify({ pid: process.pid, runId, startedAt: new Date().toISOString() }, null, '\t')}\n`;

	await mkdir(dirname(lockPath), { recursive: true });

	let stalePid: number | undefined;

	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			await writeFile(lockPath, payload, { flag: 'wx' });

			return { stalePid };
		} catch (error) {
			const isAlreadyHeld = typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';

			if (!isAlreadyHeld) {
				throw error;
			}
		}

		const holder = await readRunLock({ cwd });

		if (holder && isPidAlive({ pid: holder.pid })) {
			throw new RunLockError(describeRunLockHolder({ holder }));
		}

		stalePid = holder?.pid;
		await unlink(lockPath).catch(() => undefined);
	}

	throw new RunLockError('could not acquire .lightsout/lock.json — another process keeps taking the lock');
};
