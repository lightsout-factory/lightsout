import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	/** cwd-relative paths of files that exist on disk. */
	paths: string[];
}

/**
 * Hashes working files as `git add` would store them, without writing them to
 * the object store, so an id compares equal to the one `git ls-tree` reports for
 * the same bytes. The checkout filters stay on for that reason. Paths are hashed
 * in chunks so a move carrying hundreds of files stays under the shell's
 * argument limit.
 *
 * @returns path → blob id, or `undefined` when any chunk cannot be hashed
 */
export const readGitWorkingBlobIds = async ({ cwd, paths }: Params): Promise<Map<string, string> | undefined> => {
	const chunkSize = 200;
	let blobIds: Map<string, string> | undefined = new Map();

	for (let start = 0; start < paths.length && blobIds !== undefined; start += chunkSize) {
		const chunk = paths.slice(start, start + chunkSize);
		const quoted = chunk.map((path) => quoteShellArgument({ argument: path })).join(' ');
		const hashed = await runCommand({ command: `git hash-object -- ${quoted}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

		const ids = hashed?.exitCode === 0 ? hashed.stdout.split('\n').filter(Boolean) : [];

		if (ids.length === chunk.length) {
			for (const [index, path] of chunk.entries()) {
				blobIds.set(path, ids[index] ?? '');
			}
		} else {
			blobIds = undefined;
		}
	}

	return blobIds;
};
