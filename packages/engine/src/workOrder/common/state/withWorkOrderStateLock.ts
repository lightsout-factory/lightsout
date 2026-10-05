import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { messageOf } from '#src/common/messageOf.ts';
import { isPidAlive } from '#src/runState/liveness/isPidAlive.ts';
import { workOrderFileNames } from '#src/workOrder/common/constants/workOrderFileNames.ts';

interface Params<Result> {
	/** In the primary checkout; created here when missing. */
	workOrderFolder: string;
	run: () => Promise<Result>;
}

const LockHolder = z.object({ pid: z.number(), token: z.string(), acquiredAt: z.string() });

const sleep = ({ ms }: { ms: number }) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const readHolder = ({ lockPath }: { lockPath: string }) => {
	let holder: z.infer<typeof LockHolder> | undefined;

	try {
		holder = LockHolder.parse(JSON.parse(readFileSync(lockPath, 'utf8')));
	} catch {
		holder = undefined;
	}

	return holder;
};

/**
 * Renamed aside, never unlinked: two callers can both judge one leftover
 * reclaimable, and the second's unlink would delete the first's fresh lock. A
 * rename of a missing source fails, so exactly one wins.
 */
const claimLeftover = ({ lockPath, token }: { lockPath: string; token: string }) => {
	const asidePath = `${lockPath}.claim-${process.pid}-${token}`;
	let claimed = false;

	try {
		renameSync(lockPath, asidePath);
		claimed = true;
	} catch {
		claimed = false;
	}

	if (claimed) {
		try {
			unlinkSync(asidePath);
		} catch {
			// Failing to remove the moved-aside file must never stop the lock being taken.
		}
	}

	return claimed;
};

const createLock = ({ lockPath, token }: { lockPath: string; token: string }) => {
	let outcome: { created: true } | { present: true } | { failure: string };

	try {
		writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, token, acquiredAt: new Date().toISOString() })}\n`, { flag: 'wx' });

		outcome = { created: true };
	} catch (error) {
		const present = typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';

		outcome = present ? { present: true } : { failure: messageOf({ error }) };
	}

	return outcome;
};

/**
 * Filesystem access is synchronous so nothing else in this process can
 * interleave between reading a holder and taking the lock. An unparseable lock
 * is read twice, so one written between the first read and the create is not
 * judged a leftover.
 */
const acquireLock = async ({ lockPath, token }: { lockPath: string; token: string }) => {
	const pollIntervalMs = 100;
	const waitCeilingMs = 10_000;
	const startedAt = Date.now();

	let outcome: { acquired: true } | { error: string } | undefined;
	let heldBy: number | undefined;

	while (outcome === undefined) {
		const holder = readHolder({ lockPath });
		let retryAtOnce = false;

		if (holder !== undefined) {
			heldBy = holder.pid;
			retryAtOnce = !isPidAlive({ pid: holder.pid }) && claimLeftover({ lockPath, token });
		} else {
			const attempt = createLock({ lockPath, token });

			if ('created' in attempt) {
				outcome = { acquired: true };
			} else if ('failure' in attempt) {
				outcome = { error: `the work order state lock ${lockPath} could not be taken: ${attempt.failure}` };
			} else {
				retryAtOnce = readHolder({ lockPath }) === undefined ? claimLeftover({ lockPath, token }) : true;
			}
		}

		if (outcome === undefined && !retryAtOnce) {
			if (Date.now() - startedAt >= waitCeilingMs) {
				outcome = {
					error: `the work order state lock ${lockPath} is held by process ${heldBy ?? 'unknown'} and was still held after ${waitCeilingMs / 1000} seconds — wait for that command to finish, or remove the lock file if that process is gone`,
				};
			} else {
				await sleep({ ms: pollIntervalMs });
			}
		}
	}

	return outcome;
};

/** Only our own: a lock another caller has since reclaimed is left in place. */
const releaseLock = ({ lockPath, token }: { lockPath: string; token: string }) => {
	if (readHolder({ lockPath })?.token !== token) {
		return;
	}

	try {
		unlinkSync(lockPath);
	} catch {
		// Already gone, or gone by another hand: either way the record is free.
	}
};

/**
 * Not the gate lock, which is keyed to the machine rather than one record and
 * waits far longer.
 *
 * Lock-ordering invariant: nothing inside `run` takes another lock, and this lock
 * is never held across a tracker call or a gate run.
 */
export const withWorkOrderStateLock = async <Result>({ workOrderFolder, run }: Params<Result>): Promise<Result | { error: string }> => {
	try {
		mkdirSync(workOrderFolder, { recursive: true });
	} catch (error) {
		return { error: `the work order folder ${workOrderFolder} could not be created: ${messageOf({ error })}` };
	}

	const lockPath = join(workOrderFolder, workOrderFileNames.lock);
	const token = randomUUID();
	const acquisition = await acquireLock({ lockPath, token });

	if ('error' in acquisition) {
		return acquisition;
	}

	try {
		return await run();
	} finally {
		releaseLock({ lockPath, token });
	}
};
