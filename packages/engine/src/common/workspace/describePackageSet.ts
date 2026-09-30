interface Params {
	/** Package folder names under packages-dir; '' is the repo root group. */
	packages: string[];
}

/**
 * The one label for a set of package groups, so a heading, a note, the run
 * header and the config view all name a set alike. The root comes first and
 * the packages follow in name order, whatever order they were given in.
 */
export const describePackageSet = ({ packages }: Params): string => {
	const names = [...new Set(packages)].filter((name) => name !== '').sort((first, second) => first.localeCompare(second));
	const labels = packages.includes('') ? ['repo root (outside packages)', ...names] : names;

	return labels.join(', ');
};
