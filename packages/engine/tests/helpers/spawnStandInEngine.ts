import { type ChildProcess, spawn } from 'node:child_process';
import { afterEach } from '@jest/globals';

interface Params {
	ignoresSigterm?: boolean;
}

const spawned: ChildProcess[] = [];

// Registered on import, so every test file that spawns a stand-in engine kills
// it after each case and a failed assertion never leaves one running.
afterEach(() => {
	for (const child of spawned.splice(0)) {
		child.kill('SIGKILL');
	}
});

/**
 * A stand-in engine: a Node child that exits on SIGTERM unless told to trap it,
 * resolved once it is ready.
 *
 * @param ignoresSigterm - trap SIGTERM, so only SIGKILL ends it
 */
export const spawnStandInEngine = async ({ ignoresSigterm = false }: Params = {}): Promise<{ child: ChildProcess; pid: number }> => {
	const trap = ignoresSigterm ? "process.on('SIGTERM', () => {});" : '';
	const child = spawn(process.execPath, ['-e', `${trap} console.log('ready'); setTimeout(() => process.exit(0), 60_000);`], {
		stdio: ['ignore', 'pipe', 'ignore'],
	});

	spawned.push(child);
	await new Promise((resolve) => child.stdout?.once('data', resolve));

	if (child.pid === undefined) {
		throw new Error('the stand-in engine was given no pid');
	}

	return { child, pid: child.pid };
};
