import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { messageOf } from '#src/common/messageOf.ts';
import type { GateLock } from '#src/contracts/gates/GateLock.ts';
import { gateLockTimings } from '#src/gates/gateLock/internal/common/constants/gateLockTimings.ts';
import { describeGateLockHolder } from '#src/gates/gateLock/internal/common/utils/describeGateLockHolder.ts';
import { isGateLockReclaimable } from '#src/gates/gateLock/internal/common/utils/isGateLockReclaimable/isGateLockReclaimable.ts';
import { readGateLock } from '#src/gates/gateLock/internal/readGateLock.ts';

interface Params {
	/** Resolved once by `withGateLock`, because resolving it asks git. */
	lockPath: string;
	/** The checkout recorded on the document, which is the worktree a waiter names. */
	cwd: string;
	runId: string;
	/** Zero means one attempt and no wait. */
	waitCeilingMs: number;
	onProgress?: (message: string) => void;
}

interface Acquisition {
	acquired: boolean;
	/** Undefined when the document could not be read. */
	holder: GateLock | undefined;
	waitedMs: number;
	/** A filesystem error, not a conflicting holder; never set beside a holder. */
	failure: string | undefined;
}

const sleep = ({ ms }: { ms: number }) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const codeOf = ({ error }: { error: unknown }) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

/**
 * Renames aside rather than unlinking: two waiters can both judge the same
 * leftover reclaimable, and the second unlink would delete the first one's
 * fresh reservation. A rename whose source is gone fails, so exactly one wins.
 */
const claimLeftover = ({ lockPath, runId }: { lockPath: string; runId: string }) => {
	const asidePath = `${lockPath}.claim-${process.pid}-${runId}`;

	try {
		renameSync(lockPath, asidePath);
	} catch {
		return false;
	}

	try {
		unlinkSync(asidePath);
	} catch {
		// Failing to remove the moved-aside document must never stop the
		// reservation it just freed from being taken.
	}

	return true;
};

/**
 * `present` says only what `EEXIST` says: whether the document belongs to a
 * live run is the caller's to judge from what it reads back.
 */
const createReservation = ({ lockPath, cwd, runId }: { lockPath: string; cwd: string; runId: string }) => {
	// The default means retry at once: nothing is there and nothing failed.
	let outcome: { created: boolean; present: boolean; failure: string | undefined } = { created: false, present: false, failure: undefined };

	try {
		const payload = { pid: process.pid, runId, worktree: cwd, startedAt: new Date().toISOString(), gateGroups: [] };

		writeFileSync(lockPath, `${JSON.stringify(payload, null, '\t')}\n`, { flag: 'wx' });

		outcome = { created: true, present: false, failure: undefined };
	} catch (error) {
		const code = codeOf({ error });

		// Only the shared folder is created, never its parent checkout: creating
		// that would fabricate the missing working directory and report green
		// from inside an empty folder.
		const sharedFolderMissing = code === 'ENOENT' && existsSync(dirname(dirname(lockPath)));

		if (code === 'EEXIST') {
			outcome = { created: false, present: true, failure: undefined };
		} else if (!sharedFolderMissing) {
			outcome = { created: false, present: false, failure: messageOf({ error }) };
		} else {
			try {
				mkdirSync(dirname(lockPath), { recursive: true });
			} catch (mkdirError) {
				outcome = { created: false, present: false, failure: messageOf({ error: mkdirError }) };
			}
		}
	}

	return outcome;
};

/**
 * File access is synchronous so nothing else in this process can interleave
 * between reading a holder and taking the machine it left.
 *
 * Each poll reads before it attempts the create, so the common case — another
 * run holding the machine — costs one read and the waiter can say so promptly.
 *
 * It never throws: every gate caller destructures a returned result. A zero
 * `waitCeilingMs` suppresses only the sleeping; the reclaim path still runs,
 * because a leftover is a free machine and must never be reported busy.
 */
export const acquireGateLock = async ({ lockPath, cwd, runId, waitCeilingMs, onProgress }: Params): Promise<Acquisition> => {
	const startedAt = Date.now();

	let outcome: Acquisition | undefined;
	let announcedAt: number | undefined;

	while (outcome === undefined) {
		const holder = readGateLock({ lockPath });
		// Only a pass that changed something retries at once, so a leftover
		// nobody can claim — a corrupt document under a read-only folder — costs
		// a poll each time round rather than spinning the loop.
		let retryAtOnce = false;

		if (holder !== undefined) {
			retryAtOnce = isGateLockReclaimable({ lock: holder }) && claimLeftover({ lockPath, runId });
		} else {
			const attempt = createReservation({ lockPath, cwd, runId });

			if (attempt.created) {
				outcome = { acquired: true, holder: undefined, waitedMs: Date.now() - startedAt, failure: undefined };
			} else if (attempt.failure !== undefined) {
				outcome = { acquired: false, holder: undefined, waitedMs: Date.now() - startedAt, failure: attempt.failure };
			} else if (!attempt.present) {
				retryAtOnce = true;
			} else {
				// The document would not parse a moment ago. The second read tells a
				// truncated leftover from a live run that wrote a whole one in between,
				// so a fresh reservation is never moved aside.
				retryAtOnce = readGateLock({ lockPath }) === undefined ? claimLeftover({ lockPath, runId }) : true;
			}
		}

		if (outcome === undefined && !retryAtOnce) {
			const waitedMs = Date.now() - startedAt;

			if (waitedMs >= waitCeilingMs) {
				outcome = { acquired: false, holder, waitedMs, failure: undefined };
			} else {
				if (announcedAt === undefined || waitedMs - announcedAt >= gateLockTimings.progressIntervalMs) {
					announcedAt = waitedMs;
					onProgress?.(`gate reservation: waiting for the machine — ${describeGateLockHolder({ lock: holder })}`);
				}

				await sleep({ ms: gateLockTimings.pollIntervalMs });
			}
		}
	}

	return outcome;
};
