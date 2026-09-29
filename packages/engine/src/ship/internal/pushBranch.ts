import { runCommand } from '#src/common/processes/runCommand.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { ShipStepFailure } from '#src/ship/common/types/ShipStepFailure.ts';

interface Params {
	branch: string;
	cwd: string;
}

/**
 * `--set-upstream` makes every push the same command, and an up-to-date branch exits 0, so
 * re-running ship pushes again harmlessly. Its own deadline because `gitTimeoutMs` is sized for
 * local reads, and this crosses the network.
 */
export const pushBranch = async ({ branch, cwd }: Params): Promise<ShipStepFailure | undefined> => {
	const pushTimeoutMs = 60_000;
	const pushed = await runCommand({ command: `git push --set-upstream origin ${branch}`, cwd, timeoutMs: pushTimeoutMs }).catch((error) => ({
		exitCode: -1,
		stdout: '',
		stderr: messageOf({ error }),
	}));

	return pushed.exitCode === 0 ? undefined : { stderr: pushed.stderr };
};
