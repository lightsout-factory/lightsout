import type { ChildProcess } from 'node:child_process';
import { killGraceMs } from '#src/common/constants/killGraceMs.ts';
import { killProcessGroup } from '#src/common/processes/killProcessGroup.ts';

interface Params {
	children: Iterable<ChildProcess>;
	/** How long the children get to honour SIGTERM before they are killed outright. */
	graceMs?: number;
}

const settled = ({ child }: { child: ChildProcess }) => child.exitCode !== null || child.signalCode !== null;

const exited = ({ child }: { child: ChildProcess }): Promise<void> =>
	settled({ child }) ? Promise.resolve() : new Promise((resolve) => child.once('exit', () => resolve()));

/**
 * SIGTERM regardless of what prompted the shutdown: a shell sets SIGINT to
 * ignore on the jobs it backgrounds, so relaying Ctrl-C verbatim would leave a
 * backgrounded harness running.
 *
 * Whatever outlives the grace period is killed outright, or a harness that
 * traps SIGTERM would outlive the engine. The grace timer is deliberately not
 * unref'd: the caller usually ends the engine next, and a kill the runtime is
 * free to skip is not a kill.
 */
export const terminateChildGroups = async ({ children, graceMs = killGraceMs }: Params): Promise<void> => {
	const targets = [...children];

	for (const child of targets) {
		killProcessGroup({ child, signal: 'SIGTERM' });
	}

	if (targets.length === 0) {
		return;
	}

	let grace: NodeJS.Timeout | undefined;

	await Promise.race([
		Promise.all(targets.map((child) => exited({ child }))),
		new Promise((resolve) => {
			grace = setTimeout(resolve, graceMs);
		}),
	]);

	clearTimeout(grace);

	for (const child of targets) {
		if (!settled({ child })) {
			killProcessGroup({ child, signal: 'SIGKILL' });
		}
	}
};
