import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunLiveness } from '#src/runState/common/types/RunLiveness.ts';
import { isPidAlive } from '#src/runState/isPidAlive.ts';
import { isRecordedProcessAlive } from '#src/runState/isRecordedProcessAlive.ts';
import { isRunLive } from '#src/runState/isRunLive.ts';
import { readRunProcessLock } from '#src/runState/lock/readRunProcessLock.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { resolveOwnerProcess } from '#src/runState/owner/resolveOwnerProcess.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';

/** A run folder that cannot be found holds no owner record; any other failure is the caller's to see. */
const readOwnerOrNothing = ({ cwd, runId }: { cwd: string; runId: string }) =>
	readRunOwner({ cwd, runId }).catch((error: unknown) => {
		if (error instanceof RunNotFoundError) {
			return undefined;
		}

		throw error;
	});

/**
 * Only a root that recorded no owner — one started before owner records existed
 * — is judged by the lock. Read per run rather than once, because the lock is
 * per-checkout and an isolated run's holder is in the workspace it recorded.
 */
const readLiveLockHolder = async ({ cwd, manifest }: { cwd: string; manifest: RunManifest }) => {
	const lock = await readRunProcessLock({ cwd, manifest });

	return lock !== undefined && isPidAlive({ pid: lock.pid }) ? lock : undefined;
};

interface Params {
	/** The checkout the reader was launched from — where the run's records live. */
	cwd: string;
	manifest: RunManifest;
}

/**
 * Gathers what `isRunLive` judges — the family root's owner record, the root
 * manifest for a phase child, and the lock only for a root with no owner — and
 * names the process answering for the run. A finished run is answered without
 * reading anything, so listing a long history never probes a process per run.
 */
export const readRunLiveness = async ({ cwd, manifest }: Params): Promise<RunLiveness> => {
	if (manifest.status !== RunStatus.Running && manifest.status !== RunStatus.Pending) {
		return { live: false, pid: undefined };
	}

	const { parentRunId } = manifest;
	const root = parentRunId === undefined ? undefined : await readRunManifest({ cwd, runId: parentRunId }).catch(() => undefined);
	const owner = await readOwnerOrNothing({ cwd, runId: parentRunId ?? manifest.runId });
	const ownerProcess = owner === undefined ? undefined : await resolveOwnerProcess({ cwd, owner });
	const ownerAlive = owner === undefined ? undefined : ownerProcess !== undefined && (await isRecordedProcessAlive(ownerProcess));
	const lockHolder = owner === undefined ? await readLiveLockHolder({ cwd, manifest }) : undefined;
	const live = isRunLive({ manifest, root, ownerAlive, liveLockRunId: lockHolder?.runId });

	return { live, pid: live ? (ownerProcess?.pid ?? lockHolder?.pid) : undefined };
};
