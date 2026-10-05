import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { readGitPrefix } from '#src/common/git/readGitPrefix.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	/** Read a move as a removal and an addition, rather than as one entry naming the destination. */
	splitRenames: boolean;
}

interface GitStatusEntry {
	/** The two status letters git prints before the path. */
	code: string;
	/** Relative to `cwd`. */
	path: string;
}

/** What `git status` lists under `cwd`, the engine's own `.lightsout/` files left out; undefined outside a git worktree. */
export const readGitStatusEntries = async ({ cwd, splitRenames }: Params): Promise<GitStatusEntry[] | undefined> => {
	const prefix = await readGitPrefix({ cwd });

	if (prefix === undefined) {
		return undefined;
	}

	const command = `git status --porcelain=v1 -uall${splitRenames ? ' --no-renames' : ''} -- .`;
	const status = await runCommand({ command, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (status?.exitCode !== 0) {
		return undefined;
	}

	// Porcelain paths are repo-root-relative; strip the cwd's prefix so they
	// line up with the repo-relative paths agents report.
	return status.stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const listed = line.slice(3);
			// A rename is recorded as `old -> new`; only the destination is a file
			// that now exists.
			const arrow = splitRenames ? -1 : listed.lastIndexOf(' -> ');
			const path = (arrow === -1 ? listed : listed.slice(arrow + ' -> '.length)).replace(/^"|"$/g, '');

			return { code: line.slice(0, 2), path: prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path };
		})
		.filter((entry) => !entry.path.startsWith('.lightsout/'));
};
