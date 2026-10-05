import type { ChildProcess } from 'node:child_process';
import { terminateChildGroups } from '#src/common/processes/collectChildOutput/relayShutdownSignals/terminateChildGroups.ts';

const relayed: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
const live = new Set<ChildProcess>();

let installed = false;
let shuttingDown = false;

const onSignal = async (signal: NodeJS.Signals) => {
	// A repeat Ctrl-C would otherwise start the grace period over.
	if (shuttingDown) {
		return;
	}

	shuttingDown = true;

	// Awaited, so the children are gone before the engine is: re-raising first
	// would take the SIGKILL escalation down with the engine and orphan a
	// harness that traps SIGTERM.
	await terminateChildGroups({ children: live });

	// Re-raising restores the default disposition, so the engine dies on Ctrl-C
	// with the exit status a caller expects; merely listening would swallow it.
	uninstall();
	process.kill(process.pid, signal);
};

const handlers = new Map<NodeJS.Signals, () => void>(relayed.map((signal) => [signal, () => void onSignal(signal)]));

const install = () => {
	if (installed) {
		return;
	}

	installed = true;

	for (const [signal, handler] of handlers) {
		process.on(signal, handler);
	}
};

function uninstall(): void {
	if (!installed) {
		return;
	}

	installed = false;

	for (const [signal, handler] of handlers) {
		process.removeListener(signal, handler);
	}
}

interface Params {
	/** A child spawned with `detached: true`, for as long as it is running. */
	child: ChildProcess;
}

/**
 * A child in its own process group is out of the terminal's foreground group,
 * so Ctrl-C would no longer reach it; relaying the signal restores that while
 * keeping the group.
 *
 * One pair of process listeners is shared by every live child, because several
 * harnesses run at once and per-child listeners would trip Node's
 * max-listener warning.
 *
 * @returns a function that stops relaying to this child — call it once the
 * child has settled, or its group id will be reused by an unrelated process.
 */
export const relayShutdownSignals = ({ child }: Params): (() => void) => {
	live.add(child);
	install();

	return () => {
		live.delete(child);

		if (live.size === 0) {
			uninstall();
		}
	};
};
