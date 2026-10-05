import type { GateLock } from '#src/contracts/gates/GateLock.ts';

interface Params {
	/** Undefined when the reservation could not be read or parsed. */
	lock: GateLock | undefined;
}

/**
 * Shared by the waiting line and the refusal sentence: one event gets one
 * spelling, because two spellings read as two different events.
 */
export const describeGateLockHolder = ({ lock }: Params): string => {
	if (lock === undefined) {
		return 'another gate run whose reservation on this machine could not be read';
	}

	const heldMs = Date.now() - Date.parse(lock.startedAt);

	return `run ${lock.runId} in ${lock.worktree}, which has held it for ${Math.floor(heldMs / 60_000)}m ${Math.floor((heldMs % 60_000) / 1_000)}s`;
};
