import type { RunLock } from '#src/contracts/run/RunLock.ts';

interface Params {
	holder: RunLock;
}

export const describeRunLockHolder = ({ holder }: Params): string => {
	return `another lightsout run is active in this repo: run ${holder.runId} (pid ${holder.pid}, started ${holder.startedAt}). Wait for it to finish — or delete .lightsout/lock.json if you are certain nothing is running.`;
};
