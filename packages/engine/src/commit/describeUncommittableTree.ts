import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';

interface Params {
	/** The workspace the run will build and commit in — never the checkout the command was launched from. */
	cwd: string;
	/** Whether that workspace is a tree lightsout cut or adopted for this run. An isolated tree is never judged. */
	isolated: boolean;
	/** Path prefixes whose changes are never judged. */
	generated: string[];
	/** The advice closing a dirty-tree refusal. Defaults to commit-or-stash advice. */
	remedy?: string;
}

// Capped so one large dirty tree cannot bury the advice that closes the refusal.
const listPaths = ({ paths }: { paths: string[] }) => {
	const listedPathLimit = 20;
	const listed = paths.slice(0, listedPathLimit).join(', ');

	return paths.length > listedPathLimit ? `${listed} and ${paths.length - listedPathLimit} more` : listed;
};

/**
 * Stands before anything that ends in `git add -A` in a checkout a person chose
 * to work in, where anything already there would ride into the ticket's branch.
 *
 * An isolated tree is never judged: a freshly cut worktree is clean, and an
 * adopted one holds only the ticket's own work on the ticket's own branch.
 * An unreadable tree's sentence never carries the remedy: there is nothing to stash.
 *
 * @returns undefined when the tree may be committed, or the one sentence saying why it may not
 */
export const describeUncommittableTree = async ({ cwd, isolated, generated, remedy = 'commit or stash them first' }: Params): Promise<string | undefined> => {
	if (isolated) {
		return undefined;
	}

	const changed = await readGitChangedFiles({ cwd });
	let refusal: string | undefined;

	if (changed === undefined) {
		refusal = `git could not read the tree at ${cwd} — the run commits what it builds, so it needs a readable git worktree`;
	} else {
		const dirty = changed.filter((path) => !isGeneratedPath({ path, generated }));

		if (dirty.length > 0) {
			refusal = `the run commits everything in the tree at ${cwd}, which holds uncommitted changes: ${listPaths({ paths: dirty })} — ${remedy}`;
		}
	}

	return refusal;
};
