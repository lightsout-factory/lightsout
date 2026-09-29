interface Params {
	/** A file path; only its extension is read. */
	path: string;
}

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

export const toCodeLanguage = ({ path }: Params): string | undefined => languages[path.slice(path.lastIndexOf('.') + 1).toLowerCase()];
