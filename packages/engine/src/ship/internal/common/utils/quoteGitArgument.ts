interface Params {
	/** A ref, a commit or a path — data, never syntax. */
	argument: string;
}

/** Git commands here run through a shell, and a conflicted path may carry quotes, spaces and metacharacters that must never execute. */
export const quoteGitArgument = ({ argument }: Params): string => `'${argument.split("'").join(`'\\''`)}'`;
