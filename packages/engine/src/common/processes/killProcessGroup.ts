import type { ChildProcess } from 'node:child_process';

interface Params {
	/** A child spawned with `detached: true`, so its pid is also its group id. */
	child: ChildProcess;
	signal: NodeJS.Signals;
}

/**
 * `child.kill()` reaches exactly one process, leaving descendants alive and
 * holding the inherited stdout pipe. Signalling the process group reaches all
 * of them in one call, and cannot race a process spawned mid-sweep the way
 * walking a process tree can.
 *
 * Windows has no POSIX process groups, so the direct child is signalled there
 * and its descendants are left.
 */
export const killProcessGroup = ({ child, signal }: Params): void => {
	if (child.pid !== undefined && process.platform !== 'win32') {
		try {
			process.kill(-child.pid, signal);

			return;
		} catch {
			// A child not spawned detached leads no group and must still be
			// killed, so fall through rather than return.
		}
	}

	try {
		child.kill(signal);
	} catch {
		// already gone
	}
};
