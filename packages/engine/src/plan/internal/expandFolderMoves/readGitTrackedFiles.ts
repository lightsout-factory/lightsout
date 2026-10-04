import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	/** cwd-relative folder paths with no trailing `/`; never empty — the caller asks only when it has a folder to list. */
	folders: string[];
}

/**
 * `--literal-pathspecs` reads a folder name holding glob characters, such as
 * `app/[slug]`, as written rather than as a pattern. Without `--full-name`,
 * `git ls-files` answers relative to `cwd`, the frame plan paths are written in,
 * so a nested consumer needs no prefix stripping. Untracked files are never listed.
 */
export const readGitTrackedFiles = async ({ cwd, folders }: Params): Promise<string[] | undefined> => {
	const pathspecs = folders.map((folder) => quoteShellArgument({ argument: folder })).join(' ');
	const listing = await runCommand({ command: `git --literal-pathspecs ls-files -z -- ${pathspecs}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return listing?.exitCode === 0 ? listing.stdout.split('\0').filter(Boolean) : undefined;
};
