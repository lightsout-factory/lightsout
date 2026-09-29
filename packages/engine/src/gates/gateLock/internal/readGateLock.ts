import { readFileSync } from 'node:fs';
import { GateLock } from '#src/contracts/gates/GateLock.ts';

interface Params {
	/** Resolved once by `withGateLock`, because resolving it asks git. */
	lockPath: string;
}

/**
 * Synchronous because it is the read half of a check-then-act on a lock:
 * nothing else in this process can interleave between reading a holder and
 * acting on it.
 */
export const readGateLock = ({ lockPath }: Params): GateLock | undefined => {
	let raw: string;

	try {
		raw = readFileSync(lockPath, 'utf8');
	} catch {
		return undefined;
	}

	try {
		return GateLock.parse(JSON.parse(raw));
	} catch {
		return undefined;
	}
};
