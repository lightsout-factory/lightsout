interface Params {
	/** One changed path, relative to the worktree. */
	path: string;
	/** The config's `generated` path prefixes, each a directory or a single file. */
	generated: string[];
}

/**
 * The boundary is a path segment rather than the source walk's bare
 * `startsWith`: a walk that skips one extra file only misses a check, while here
 * a bare prefix would delete a source file named `plugin/distortion.ts` before
 * the commit.
 */
export const isGeneratedPath = ({ path, generated }: Params): boolean =>
	generated.some((entry) => {
		const prefix = entry.replace(/\/$/, '');

		return path === prefix || path.startsWith(`${prefix}/`);
	});
