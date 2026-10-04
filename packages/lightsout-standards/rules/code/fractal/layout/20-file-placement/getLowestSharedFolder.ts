interface Params {
	/** The folder of each file using the code, as segments. */
	folders: string[][];
}

/** The folders of a `common/` that hold one kind of code rather than one subject. */
const kindFolders = new Set(['types', 'constants']);

/**
 * The folder whose `common/` should hold a file every one of `folders` uses:
 * the lowest folder holding them all, as a `/`-joined path, '' for the repo
 * root. Users sitting directly in a `common/`, or in its `types/` or
 * `constants/`, are served by that `common/`, so the file belongs beside them;
 * any other folder inside a `common/` is a folder of its own.
 */
export const getLowestSharedFolder = ({ folders }: Params): string => {
	const [first = [], ...rest] = folders;
	const firstDifference = first.findIndex((segment, index) => rest.some((folder) => folder[index] !== segment));
	const shared = firstDifference === -1 ? first : first.slice(0, firstDifference);
	const commonAt = shared.lastIndexOf('common');
	const belowCommon = shared[commonAt + 1];
	const isBesideCommonFiles = commonAt !== -1 && (belowCommon === undefined || kindFolders.has(belowCommon));

	return (isBesideCommonFiles ? shared.slice(0, commonAt) : shared).join('/');
};
