import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';

interface Params {
	/** Repo paths or configured `generated` entries, relative to the command's `cwd`. */
	paths: string[];
	/** When true, each spec excludes its path (`:(exclude,literal)`) instead of naming it (`:(literal)`). Default false. */
	exclude?: boolean;
}

/** Git's `:(literal)` magic stops a file named `[slug].tsx` being read as a pattern. */
export const toLiteralPathspecs = ({ paths, exclude = false }: Params): string => {
	const magic = exclude ? ':(exclude,literal)' : ':(literal)';

	return paths.map((path) => quoteShellArgument({ argument: `${magic}${path}` })).join(' ');
};
