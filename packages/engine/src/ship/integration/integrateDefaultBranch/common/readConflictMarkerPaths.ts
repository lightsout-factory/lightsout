import { runGit } from '#src/ship/common/runGit.ts';

interface Params {
	cwd: string;
}

/** Only the opening and closing markers, the two no resolved file ever carries. */
const addedMarker = /^\+(?:<{7}|>{7})(?: |$)/;

const diffHeader = /^\+\+\+ b\/(.+)$/;

const scanDiff = ({ diff }: { diff: string }) => {
	const found: string[] = [];
	let path: string | undefined;

	for (const line of diff.split('\n')) {
		const header = diffHeader.exec(line);
		const named = header === null ? undefined : header[1];

		if (named !== undefined) {
			path = named;
		} else if (addedMarker.test(line) && path !== undefined && !found.includes(path)) {
			found.push(path);
		}
	}

	return found;
};

/**
 * An agent that stages a file it never actually settled leaves `git diff
 * --diff-filter=U` empty — staging is what marks a path resolved — so "nothing
 * unmerged" alone cannot say a conflict was settled. Both halves are read
 * because a marker may sit in the index, on disk, or in both.
 *
 * Only ADDED lines count. A repository that legitimately carries a documented
 * marker line in committed source is not this attempt's doing, and reporting
 * it would block a ship over a file nobody touched.
 */
export const readConflictMarkerPaths = async ({ cwd }: Params): Promise<string[] | undefined> => {
	const staged = await runGit({ command: 'git -c core.quotePath=false diff --cached -U0', cwd });
	const working = await runGit({ command: 'git -c core.quotePath=false diff -U0', cwd });

	if (staged === undefined || staged.exitCode !== 0 || working === undefined || working.exitCode !== 0) {
		return undefined;
	}

	const marked = [...scanDiff({ diff: staged.stdout }), ...scanDiff({ diff: working.stdout })];

	return [...new Set(marked)];
};
