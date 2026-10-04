import type { GateLock } from '#src/contracts/gates/GateLock.ts';
import { isProcessGroupAlive } from '#src/gates/gateLock/internal/common/utils/isGateLockReclaimable/isProcessGroupAlive.ts';
import { isPidAlive } from '#src/runState/isPidAlive.ts';

interface Params {
	lock: GateLock;
}

/**
 * The dead pid alone is not enough: gates are spawned detached, so a killed
 * engine leaves live gate groups behind, and reclaiming would stack a second
 * run's suites on top of them. There is deliberately no age-based expiry: a
 * long gate run is not a stale one.
 */
export const isGateLockReclaimable = ({ lock }: Params): boolean => {
	return !isPidAlive({ pid: lock.pid }) && !lock.gateGroups.some((pgid) => isProcessGroupAlive({ pgid }));
};
