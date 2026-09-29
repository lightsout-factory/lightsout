import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';

interface Params {
	/** The workspace the run will build and commit in — never the checkout the command was launched from. */
	cwd: string;
	/** Whether that workspace is a tree lightsout cut or adopted for this run. An isolated tree is never judged. */
	isolated: boolean;
}

/**
 * Both implement commands end in `git add -A`, so in a checkout a person chose
 * to work in anything already there would ride into the ticket's branch.
 *
 * An isolated tree is never judged: a freshly cut worktree is clean, and an
 * adopted one holds only the ticket's own work on the ticket's own branch.
 */
export const describeUncommittableTree = async ({ cwd, isolated }: Params): Promise<string | undefined> => {
	if (isolated) {
		return undefined;
	}

	const dirty = await readGitChangedFiles({ cwd });
	let refusal: string | undefined;

	if (dirty === undefined) {
		refusal = `git could not read the tree at ${cwd} — the run commits what it builds, so it needs a readable git worktree`;
	} else if (dirty.length > 0) {
		refusal = `the run commits everything in the tree at ${cwd}; commit or stash your changes first`;
	}

	return refusal;
};
