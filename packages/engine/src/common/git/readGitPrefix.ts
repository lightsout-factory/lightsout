import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

/** '' at the repo root, e.g. 'fixtures/toy-calc/' when nested, undefined outside any worktree. */
export const readGitPrefix = async ({ cwd }: Params): Promise<string | undefined> => {
	const prefix = await runCommand({ command: 'git rev-parse --show-prefix', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return prefix && prefix.exitCode === 0 ? prefix.stdout.trim() : undefined;
};
