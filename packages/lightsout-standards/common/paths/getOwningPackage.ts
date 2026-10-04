interface Params {
	/** A repo-relative file path. */
	path: string;
	/** Every package directory the repo's manifests declare ('.' for the repo root). */
	packageDirectories: string[];
}

/** The nearest package directory holding the path, or undefined when no declared package holds it. */
export const getOwningPackage = ({ path, packageDirectories }: Params): string | undefined =>
	packageDirectories.filter((directory) => directory === '.' || path.startsWith(`${directory}/`)).sort((first, second) => second.length - first.length)[0];
