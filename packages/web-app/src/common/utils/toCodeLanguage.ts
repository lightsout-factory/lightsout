interface Params {
	/** A file path; only its extension is read. */
	path: string;
}

/** The highlighter grammar for each file extension a code block is given. */
const languages: Record<string, string> = {
	ts: 'typescript',
	mts: 'typescript',
	cts: 'typescript',
	tsx: 'tsx',
	js: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	jsx: 'jsx',
	json: 'json',
	md: 'markdown',
};

/**
 * The grammar a file is highlighted with, from its extension. A file whose
 * extension has no grammar is shown as plain text rather than guessed at.
 *
 * @param path - the file's path
 */
export const toCodeLanguage = ({ path }: Params): string | undefined => languages[path.slice(path.lastIndexOf('.') + 1).toLowerCase()];
