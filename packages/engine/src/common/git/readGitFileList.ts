import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { readGitPrefix } from '#src/common/git/readGitPrefix.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

const listPaths = async ({ cwd, flags }: { cwd: string; flags: string }) => {
	const listed = await runCommand({ command: `git ls-files -z ${flags} -- .`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return listed?.exitCode === 0 ? listed.stdout.split('\0').filter(Boolean) : undefined;
};

/**
 * Every file under `cwd` that exists and that the repo does not ignore: tracked
 * files, and untracked ones `.gitignore` lets through. The repo's own ignore
 * rules are what keep its dependencies and build output out, so no folder name
 * has to be guessed. Paths are relative to `cwd`; undefined outside a git
 * worktree.
 */
export const readGitFileList = async ({ cwd }: Params): Promise<string[] | undefined> => {
	if ((await readGitPrefix({ cwd })) === undefined) {
		return undefined;
	}

	const [present, deleted] = await Promise.all([listPaths({ cwd, flags: '--cached --others --exclude-standard' }), listPaths({ cwd, flags: '--deleted' })]);

	if (present === undefined) {
		return undefined;
	}

	const gone = new Set(deleted ?? []);

	return [...new Set(present)].filter((path) => !gone.has(path)).sort();
};
