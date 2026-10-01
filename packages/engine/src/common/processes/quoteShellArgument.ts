interface Params {
	/** A path, a branch, a ref or any other word that is data, never syntax. */
	argument: string;
}

/**
 * `runCommand` spawns through a shell, and a path or branch may carry spaces, quotes and metacharacters that must never execute.
 * Wrapped in single quotes, with any single quote of its own closed and re-opened around an escaped one.
 */
export const quoteShellArgument = ({ argument }: Params): string => `'${argument.split("'").join(`'\\''`)}'`;
