import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	/** The directory `git add -A -- .` staged. */
	cwd: string;
	maxDiffLength: number;
}

/**
 * The wide stat width keeps long paths whole, and the stat is never cut because
 * it is the complete record of what changed. A failed read answers undefined,
 * never an empty change: an index nobody could read has not been shown to hold nothing.
 */
export const readGitStagedChange = async ({ cwd, maxDiffLength }: Params): Promise<{ stat: string; diff: string; truncated: boolean } | undefined> => {
	const diffCommand = 'git -c core.quotePath=false diff --cached --no-color --no-ext-diff';
	const [stat, diff] = await Promise.all([
		runCommand({ command: `${diffCommand} --stat=1000 -- .`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined),
		runCommand({ command: `${diffCommand} -- .`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined),
	]);

	if (stat?.exitCode !== 0 || diff?.exitCode !== 0) {
		return undefined;
	}

	const truncated = diff.stdout.length > maxDiffLength;

	return { stat: stat.stdout, diff: truncated ? diff.stdout.slice(0, maxDiffLength) : diff.stdout, truncated };
};
