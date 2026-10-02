import type { SharedCodeFolder } from '#src/common/types/SharedCodeFolder.ts';

const sharedFolder = 'common';
const privateFolder = 'internal';

/** Every folder above a file, nearest first, ending at the repo root as the empty string. */
const ancestorsOf = ({ path }: { path: string }) => {
	const folders = path.split('/').slice(0, -1);

	return folders.map((_, index) => folders.slice(0, folders.length - index).join('/')).concat('');
};

/** A folder shares through its own `common/`, and through the `common/` of its `internal/`, which any file inside the folder may import. */
const reachableFrom = ({ workFiles }: { workFiles: string[] }) =>
	new Set(
		workFiles
			.flatMap((path) => ancestorsOf({ path }))
			.flatMap((folder) =>
				[
					[folder, sharedFolder],
					[folder, privateFolder, sharedFolder],
				].map((parts) => parts.filter((part) => part !== '').join('/')),
			),
	);

const compareText = ({ left, right }: { left: string; right: string }) => (left === right ? 0 : left > right ? 1 : -1);

const depthOf = ({ path }: { path: string }) => path.split('/').length;

interface Params {
	/** Every source file in the repo that is not a test, repo-relative. */
	sourceFiles: string[];
	/** The files the agent is about to work on, repo-relative. One the work will create need not exist yet. */
	workFiles: string[];
}

/**
 * The shared code visible from a set of files: every `common/` folder on the
 * way up from each of them, deepest first, since the nearest one is the most
 * specific to the work.
 *
 * A file below a nested `common/` or `internal/` is left out of the outer
 * folder's listing. It serves, or is private to, the folder that holds it, and
 * a work file inside that folder reaches it through its own way up.
 */
export const findSharedCode = ({ sourceFiles, workFiles }: Params): SharedCodeFolder[] => {
	const reachable = reachableFrom({ workFiles });
	const folders = new Map<string, Map<string, string[]>>();

	for (const file of sourceFiles) {
		const segments = file.split('/');
		const name = (segments.at(-1) ?? '').replace(/\.[^.]+$/, '');

		segments.forEach((segment, index) => {
			const path = segments.slice(0, index + 1).join('/');
			const below = segments.slice(index + 1, -1);
			const isOwnFile = !below.includes(sharedFolder) && !below.includes(privateFolder);

			if (segment === sharedFolder && index < segments.length - 1 && reachable.has(path) && isOwnFile) {
				const groups = folders.get(path) ?? new Map<string, string[]>();
				const folder = below.join('/');

				groups.set(folder, [...(groups.get(folder) ?? []), name]);
				folders.set(path, groups);
			}
		});
	}

	return [...folders]
		.map(([path, groups]) => ({
			path,
			groups: [...groups]
				.map(([folder, names]) => ({ folder, names: [...names].sort((left, right) => compareText({ left, right })) }))
				.sort((left, right) => compareText({ left: left.folder, right: right.folder })),
		}))
		.sort((left, right) => depthOf({ path: right.path }) - depthOf({ path: left.path }) || compareText({ left: left.path, right: right.path }));
};
