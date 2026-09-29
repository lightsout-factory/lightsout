import { runCommand } from '#src/common/processes/runCommand.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { ShipStepFailure } from '#src/ship/common/types/ShipStepFailure.ts';

interface Params {
	cwd: string;
	/** The configured `pre-ship` command, run as written. */
	command: string;
	/** The exact commit the default branch was pinned to, handed to the command so it versions against the base it will merge into. */
	baseCommit?: string;
	onProgress?: (message: string) => void;
}

/** Stderr when the process said anything there, else stdout: build tools report on either. */
const failureWords = ({ stdout, stderr }: { stdout: string; stderr: string }): ShipStepFailure => ({ stderr: stderr.trim() === '' ? stdout : stderr });

/**
 * It prepares and does not commit: the integration owner verifies the whole candidate and commits
 * only what passed. `LIGHTSOUT_SHIP_BASE_COMMIT` carries the pinned base, so a convention that
 * compares against a base uses the one ship merged rather than a fork point that has since moved.
 */
export const runPreShip = async ({ cwd, command, baseCommit, onProgress }: Params): Promise<ShipStepFailure | undefined> => {
	onProgress?.(`pre-ship: ${command}`);

	// A gate's budget, not a git probe's: a pre-ship command typically rebuilds something.
	const preShipTimeoutMs = 10 * 60_000;

	const result = await runCommand({
		command,
		cwd,
		timeoutMs: preShipTimeoutMs,
		env: baseCommit === undefined ? undefined : { LIGHTSOUT_SHIP_BASE_COMMIT: baseCommit },
	}).catch((error: unknown) => ({ exitCode: 1, stdout: '', stderr: messageOf({ error }) }));

	return result.exitCode === 0 ? undefined : failureWords(result);
};
