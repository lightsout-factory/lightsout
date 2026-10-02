import type { ChildProcess } from 'node:child_process';

interface Params {
	child: ChildProcess;
	withinMs?: number;
}

/**
 * Whether the child has ended, or ends within the window.
 *
 * @param child - the child to watch
 * @param withinMs - how long to wait for it to end
 */
export const hasChildExited = async ({ child, withinMs = 2_000 }: Params): Promise<boolean> => {
	if (child.exitCode !== null || child.signalCode !== null) {
		return true;
	}

	return new Promise<boolean>((resolve) => {
		const timer = setTimeout(() => resolve(false), withinMs);

		child.once('exit', () => {
			clearTimeout(timer);
			resolve(true);
		});
	});
};
