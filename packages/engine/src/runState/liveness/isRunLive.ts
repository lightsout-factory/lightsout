import { findRunningChildRunId } from '#src/common/runs/findRunningChildRunId.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

interface Params {
	/** The run being asked about. */
	manifest: RunManifest;
	/** The family root's manifest when `manifest` is a phase child; undefined for a root run, or when the coordinator's manifest will not read. */
	root: RunManifest | undefined;
	/** Whether the process the family root's owner record names is alive, a queue worker's pointer already followed; undefined when the root recorded no owner. */
	ownerAlive: boolean | undefined;
	/** The run id a live run-lock holder names; consulted only when the root recorded no owner. */
	liveLockRunId: string | undefined;
}

/**
 * The one liveness rule every view shares, so a listing, a watch and the queue
 * board never disagree about the same run. A root that recorded an owner is
 * judged by that owner alone. A phase child has no owner of its own: it is the
 * moving child only while its root's owner lives and the root's running step
 * names it. A run whose root recorded no owner was started before owner records
 * existed, and only a live lock naming that run itself vouches for it.
 */
export const isRunLive = ({ manifest, root, ownerAlive, liveLockRunId }: Params): boolean => {
	if (manifest.status !== RunStatus.Running && manifest.status !== RunStatus.Pending) {
		return false;
	}

	let live: boolean;

	if (ownerAlive === undefined) {
		live = liveLockRunId === manifest.runId;
	} else if (manifest.parentRunId === undefined) {
		live = ownerAlive;
	} else {
		const movingChildId = root?.status === RunStatus.Running ? findRunningChildRunId({ manifest: root }) : undefined;

		live = ownerAlive && movingChildId === manifest.runId;
	}

	return live;
};
