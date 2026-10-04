import { toLiteralPathspecs } from '#src/commit/common/toLiteralPathspecs.ts';
import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import { runOrDescribeFailure } from '#src/common/processes/runOrDescribeFailure.ts';

interface Params {
	cwd: string;
	/** Changed paths, relative to `cwd`, every one already known to sit under a configured `generated` entry. */
	paths: string[];
}

/** @returns git's own words when it refused, or undefined once the tree is clean of them */
export const discardGeneratedChanges = async ({ cwd, paths }: Params): Promise<string | undefined> => {
	const pathspecs = toLiteralPathspecs({ paths });
	// The index is reset first because `git checkout --` restores the worktree
	// from the index, and a refused earlier attempt can leave stale build output
	// staged there.
	const resetFailure = await runOrDescribeFailure({ command: `git reset -q -- ${pathspecs}`, cwd });

	if (resetFailure !== undefined) {
		return resetFailure;
	}

	// `--full-name` is deliberately absent: `git ls-files` prints paths relative
	// to `cwd`, the same frame `readGitChangedFiles` returns.
	const listed = await runCommand({ command: `git ls-files -z -- ${pathspecs}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (listed?.exitCode !== 0) {
		return 'git could not tell which generated paths are tracked';
	}

	const tracked = listed.stdout.split('\0').filter(Boolean);
	const untracked = paths.filter((path) => !tracked.includes(path));
	// Each command is skipped when its side is empty, so neither is handed a
	// pathspec it cannot match. `git clean` omits `-x`: an ignored file could not
	// have reached the commit anyway.
	const commands = [
		...(tracked.length > 0 ? [`git checkout -- ${toLiteralPathspecs({ paths: tracked })}`] : []),
		...(untracked.length > 0 ? [`git clean -fdq -- ${toLiteralPathspecs({ paths: untracked })}`] : []),
	];

	for (const command of commands) {
		const failure = await runOrDescribeFailure({ command, cwd });

		if (failure !== undefined) {
			return failure;
		}
	}

	return undefined;
};
