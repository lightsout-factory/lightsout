interface Params {
	command: string;
}

/**
 * Returns undefined when the command has no standalone `run` token or nothing
 * follows it — callers must treat that as "unknown", not "missing".
 */
export const extractRunScriptName = ({ command }: Params): string | undefined => {
	const tokens = command.split(/\s+/);
	const runIndex = tokens.indexOf('run');

	if (runIndex === -1) {
		return undefined;
	}

	return tokens.slice(runIndex + 1).find((token) => token !== '' && !token.startsWith('-'));
};
