interface Params {
	/** `/`-separated file paths. */
	paths: string[];
}

/**
 * Two paths in the order an editor's file explorer lists them: at the first
 * segment they differ, a folder comes before a file, and names sort by how a
 * person reads them — case aside, `file2` before `file10`. A dot folder sorts
 * first because `.` sorts before every letter.
 */
const compareExplorerOrder = (path: string, otherPath: string) => {
	const segments = path.split('/');
	const otherSegments = otherPath.split('/');
	const at = segments.findIndex((segment, index) => segment !== otherSegments[index]);
	const isFolder = at < segments.length - 1;
	const isOtherFolder = at < otherSegments.length - 1;

	if (isFolder !== isOtherFolder) {
		return isFolder ? -1 : 1;
	}

	return segments[at].localeCompare(otherSegments[at], 'en', { numeric: true, sensitivity: 'base' }) || segments[at].localeCompare(otherSegments[at], 'en');
};

/**
 * A set of file paths as the rows of a tree, top to bottom: each folder once,
 * above the files and folders inside it, each row carrying how deep it sits.
 * A file row carries its whole path; a folder row carries none, since only a
 * file can be opened. The rows come in the order an editor's file explorer
 * shows them, so the tree reads like the one a developer already knows.
 *
 * @param paths - the files, in any order
 */
export const toFileTreeRows = ({ paths }: Params): Array<{ key: string; name: string; depth: number; path?: string }> => {
	const shown = new Set<string>();

	return [...paths].sort(compareExplorerOrder).flatMap((path) => {
		const segments = path.split('/');
		const folders = segments.slice(0, -1).flatMap((name, depth) => {
			const folder = segments.slice(0, depth + 1).join('/');

			if (shown.has(folder)) {
				return [];
			}

			shown.add(folder);

			return [{ key: `${folder}/`, name, depth }];
		});

		return [...folders, { key: path, name: segments[segments.length - 1], depth: segments.length - 1, path }];
	});
};
