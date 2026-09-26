interface Params {
	/** `/`-separated file paths. */
	paths: string[];
}

/**
 * A set of file paths as the rows of a tree, top to bottom: each folder once,
 * above the files and folders inside it, each row carrying how deep it sits.
 * A file row carries its whole path; a folder row carries none, since only a
 * file can be opened.
 *
 * @param paths - the files, in any order
 */
export const toFileTreeRows = ({ paths }: Params): Array<{ key: string; name: string; depth: number; path?: string }> => {
	const shown = new Set<string>();

	return [...paths].sort().flatMap((path) => {
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
