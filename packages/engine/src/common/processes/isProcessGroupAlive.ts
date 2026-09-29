interface Params {
	/** A process-group id — the pid of a shell spawned `detached`, which leads the group it started. */
	pgid: number;
}

/**
 * Gate commands are spawned `detached`, so a killed engine leaves its gates
 * alive; a dead holder pid alone does not prove the machine is free.
 *
 * `EPERM` means the group exists but belongs to another user — still alive.
 * Windows has no POSIX process groups, so the pid itself is probed there and
 * its descendants are not seen.
 */
export const isProcessGroupAlive = ({ pgid }: Params): boolean => {
	try {
		process.kill(process.platform === 'win32' ? pgid : -pgid, 0);

		return true;
	} catch (error) {
		return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPERM';
	}
};
