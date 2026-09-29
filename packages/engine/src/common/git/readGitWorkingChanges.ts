import { GitChangeKind } from '#src/common/constants/GitChangeKind.ts';
import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { readGitPrefix } from '#src/common/git/readGitPrefix.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import type { GitWorkingChange } from '#src/common/types/GitWorkingChange.ts';

interface Params {
	cwd: string;
}

/** The `D` is read first so a file added and then deleted within the run (`AD`) is never taken for a file on disk. */
const kindOf = ({ code }: { code: string }) => {
	let kind: GitChangeKind = GitChangeKind.Modified;

	if (code.includes('D')) {
		kind = GitChangeKind.Removed;
	} else if (code === '??' || code.includes('A')) {
		kind = GitChangeKind.Added;
	}

	return kind;
};

/**
 * Unlike `readGitChangedFiles`, a move is read with `--no-renames` as a removal
 * and an addition, because a caller comparing each change against `HEAD` needs both sides.
 */
export const readGitWorkingChanges = async ({ cwd }: Params): Promise<GitWorkingChange[] | undefined> => {
	const prefix = await readGitPrefix({ cwd });

	if (prefix === undefined) {
		return undefined;
	}

	const status = await runCommand({ command: 'git status --porcelain=v1 -uall --no-renames -- .', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (status?.exitCode !== 0) {
		return undefined;
	}

	// Porcelain paths are repo-root-relative; strip the cwd's prefix so they
	// line up with the repo-relative paths agents report.
	return status.stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const path = line.slice(3).replace(/^"|"$/g, '');

			return { path: prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path, kind: kindOf({ code: line.slice(0, 2) }) };
		})
		.filter((change) => !change.path.startsWith('.lightsout/'));
};
