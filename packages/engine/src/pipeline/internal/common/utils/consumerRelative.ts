interface Params {
	/** The consumer root's path inside its git repo ('' when it IS the root). */
	gitPrefix?: string;
	file: string;
}

/**
 * Agents in a consumer nested inside a larger git repo sometimes report
 * repo-root-relative paths, which would count one file twice. Stripping the
 * git prefix makes both changed-file sources speak consumer-relative paths.
 */
export const consumerRelative = ({ gitPrefix, file }: Params): string => (gitPrefix && file.startsWith(gitPrefix) ? file.slice(gitPrefix.length) : file);
