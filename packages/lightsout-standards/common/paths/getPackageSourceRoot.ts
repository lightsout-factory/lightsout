interface Params {
	/** A repo-relative file or folder path. */
	path: string;
	/** Every package directory the repo's manifests declare ('.' for the repo root). */
	packageDirectories: string[];
}

/**
 * The `src/` of the nearest package holding the path. The folder-name rules
 * govern a package's source tree, while a check is handed every file in the
 * repo; without this anchor a repo's own `tests/helpers/` and fixture trees
 * would report as violations.
 */
export const getPackageSourceRoot = ({ path, packageDirectories }: Params): string => {
	const [nearest = '.'] = packageDirectories
		.filter((directory) => directory !== '.' && path.startsWith(`${directory}/`))
		.sort((first, second) => second.length - first.length);

	return nearest === '.' ? 'src/' : `${nearest}/src/`;
};
