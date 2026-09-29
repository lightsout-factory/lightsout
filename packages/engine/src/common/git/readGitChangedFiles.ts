import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { readGitPrefix } from '#src/common/git/readGitPrefix.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

/**
 * Git's own account of what changed, the check on what agents report. Paths are
 * relative to `cwd`; undefined outside a git worktree.
 */
export const readGitChangedFiles = async ({ cwd }: Params): Promise<string[] | undefined> => {
	const prefix = await readGitPrefix({ cwd });

	if (prefix === undefined) {
		return undefined;
	}

	const status = await runCommand({ command: 'git status --porcelain=v1 -uall -- .', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (status?.exitCode !== 0) {
		return undefined;
	}

	// Porcelain paths are repo-root-relative; strip the cwd's prefix so they
	// line up with the repo-relative paths agents report.
	const root = prefix;

	return status.stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const path = line.slice(3);
			// A rename is recorded as `old -> new`; only the destination is a file
			// that now exists.
			const arrow = path.lastIndexOf(' -> ');
			const renameTarget = arrow === -1 ? path : path.slice(arrow + ' -> '.length);

			return renameTarget.replace(/^"|"$/g, '');
		})
		.map((path) => (root && path.startsWith(root) ? path.slice(root.length) : path))
		.filter((path) => !path.startsWith('.lightsout/'));
};
