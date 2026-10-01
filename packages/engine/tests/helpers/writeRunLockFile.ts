import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Params {
	dir: string;
	pid: number;
	runId: string;
}

/** A checkout's run lock, written as a holder would leave it. */
export const writeRunLockFile = ({ dir, pid, runId }: Params): void => {
	mkdirSync(join(dir, '.lightsout'), { recursive: true });
	writeFileSync(join(dir, '.lightsout', 'lock.json'), JSON.stringify({ pid, runId, startedAt: '2026-01-01T00:00:00.000Z' }));
};
