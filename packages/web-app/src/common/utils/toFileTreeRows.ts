interface Params {
	/** `/`-separated file paths. */
	paths: string[];
}

/**
 * The order an editor's file explorer lists paths in: at the first segment they
 * differ a folder comes before a file, and names compare case-insensitively and
 * numerically, so `file2` comes before `file10`.
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

/** A folder row carries no path, since only a file can be opened. */
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
