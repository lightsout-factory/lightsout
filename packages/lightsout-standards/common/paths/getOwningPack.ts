interface Params {
	/** A repo-relative path. */
	path: string;
	/** Repo-relative standards pack roots, as the input carries them. */
	standardsLibraries: string[];
}

/**
 * Each standards pack ships on its own and may import only from inside itself,
 * so two identical functions either side of a pack boundary cannot be shared:
 * the duplication rules must not report that pair.
 *
 * The longest matching root wins, so a pack nested inside another belongs to
 * the nearer one.
 */
export const getOwningPack = ({ path, standardsLibraries }: Params): string =>
	standardsLibraries.filter((root) => path.startsWith(`${root}/`)).sort((first, second) => second.length - first.length)[0] ?? '.';
