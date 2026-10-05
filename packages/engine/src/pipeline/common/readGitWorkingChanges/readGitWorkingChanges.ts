import { readGitStatusEntries } from '#src/common/git/readGitStatusEntries.ts';
import { GitChangeKind } from '#src/pipeline/common/constants/GitChangeKind.ts';
import type { GitWorkingChange } from '#src/pipeline/common/readGitWorkingChanges/GitWorkingChange.ts';

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
	const entries = await readGitStatusEntries({ cwd, splitRenames: true });

	return entries?.map((entry) => ({ path: entry.path, kind: kindOf({ code: entry.code }) }));
};
