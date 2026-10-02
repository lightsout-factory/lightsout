import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

/**
 * Every blob `HEAD` holds under `cwd`, read in one git process so a caller
 * comparing hundreds of files never spawns one per file. Without `--full-tree`,
 * `git ls-tree` lists only the subtree under `cwd`, with cwd-relative paths, the
 * frame `readGitWorkingChanges` answers in. A submodule's `commit` entry is no blob.
 *
 * @returns path → blob id, or `undefined` when git cannot answer
 */
export const readGitHeadBlobIds = async ({ cwd }: Params): Promise<Map<string, string> | undefined> => {
	const listing = await runCommand({ command: 'git ls-tree -r -z HEAD', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);
	let blobIds: Map<string, string> | undefined;

	if (listing?.exitCode === 0) {
		blobIds = new Map();

		for (const record of listing.stdout.split('\0').filter(Boolean)) {
			const tab = record.indexOf('\t');
			const [, type, id] = record.slice(0, tab).split(' ');

			if (type === 'blob' && id !== undefined) {
				blobIds.set(record.slice(tab + 1), id);
			}
		}
	}

	return blobIds;
};
