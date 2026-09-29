interface Params {
	/** A repo-relative path. */
	path: string;
	/** Repo-relative package roots, exactly as the input's `dependencies` map keys carry them — `.` for the repo itself, then one entry per workspace package that ships a manifest. */
	packageDirectories: string[];
}

/**
 * A file outside every package is inside nobody's architecture, so a rule
 * about one package's internal boundaries has nothing to hold it to.
 *
 * A repo whose manifests declare no workspace package answers `false` for every
 * path: such a repo IS one package, and reading it the other way would switch
 * the caller's rule off in every single-package repo.
 *
 * The trailing `/` keeps a root from claiming a sibling whose name merely
 * starts with it — `packages/engine` is not `packages/engine-tools`.
 *
 * The roots come from the engine's single configured packages directory, so a
 * repo spreading its members over two parents reads the other as outside every
 * package (`docs/monorepos.md`).
 */
export const isOutsideEveryPackage = ({ path, packageDirectories }: Params): boolean => {
	const workspacePackages = packageDirectories.filter((directory) => directory !== '.');

	return workspacePackages.length > 0 && !workspacePackages.some((directory) => path.startsWith(`${directory}/`));
};
