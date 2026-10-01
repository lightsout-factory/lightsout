import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

interface Params {
	pid: number;
}

/**
 * A pid alone can be reused once its process ends, so the start time is what
 * tells the recorded process from a newcomer. `ps -o lstart=` is the same
 * command on macOS and Linux, the platforms the engine's process-group handling
 * already assumes. `lstart` prints local time in the locale's words, so
 * `LC_ALL` and `TZ` are pinned: a reader in another timezone would otherwise see
 * a live engine as a different process.
 *
 * @returns the trimmed start time, or undefined when it cannot be read — which
 * means "unknown", never "dead"
 */
export const readProcessStartTime = async ({ pid }: Params): Promise<string | undefined> => {
	const output = await promisify(execFile)('ps', ['-o', 'lstart=', '-p', String(pid)], {
		env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
	}).catch(() => undefined);
	const startTime = output?.stdout.trim();

	return startTime === '' ? undefined : startTime;
};
