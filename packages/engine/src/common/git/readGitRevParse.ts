import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	/** What to ask `git rev-parse` for: a revision such as `HEAD`, or a flag such as `--show-prefix`. */
	query: string;
}

/** The trimmed answer, or undefined when git cannot answer: outside a worktree, or with no commit yet. */
export const readGitRevParse = async ({ cwd, query }: Params): Promise<string | undefined> => {
	const answer = await runCommand({ command: `git rev-parse ${query}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return answer && answer.exitCode === 0 ? answer.stdout.trim() : undefined;
};
