interface Params {
	/** Repo-relative paths of the files the run judged. */
	files: string[];
	/** The run's file text, which carries every tsconfig.json and package.json the run found. */
	contents: Map<string, string>;
}

const declaresImports = ({ text }: { text: string }) => {
	let data: unknown;

	try {
		data = JSON.parse(text);
	} catch {
		return false;
	}

	if (typeof data !== 'object' || data === null || !('imports' in data)) {
		return false;
	}

	return typeof data.imports === 'object' && data.imports !== null && !Array.isArray(data.imports);
};

/**
 * Rules that resolve imports stay silent where a package declares no aliases,
 * rather than guess; naming these folders keeps a clean report from being
 * mistaken for a question nobody asked.
 *
 * A manifest counts only when it actually declares `imports`: every package
 * ships a `package.json`, so its mere presence would report the whole repo covered.
 */
export const findFoldersWithoutAliasSource = ({ files, contents }: Params): string[] => {
	const answered = new Map<string, boolean>();

	const parentOf = ({ folder }: { folder: string }) => {
		const cut = folder.lastIndexOf('/');

		return cut === -1 ? '.' : folder.slice(0, cut);
	};

	const hasAliasSource = ({ folder }: { folder: string }): boolean => {
		const cached = answered.get(folder);

		if (cached !== undefined) {
			return cached;
		}

		const manifest = contents.get(folder === '.' ? 'package.json' : `${folder}/package.json`);
		const found =
			contents.has(folder === '.' ? 'tsconfig.json' : `${folder}/tsconfig.json`) ||
			(manifest !== undefined && declaresImports({ text: manifest })) ||
			(folder !== '.' && hasAliasSource({ folder: parentOf({ folder }) }));

		answered.set(folder, found);

		return found;
	};

	const uncovered = new Set<string>();

	for (const file of files) {
		const folder = parentOf({ folder: file });

		if (!hasAliasSource({ folder })) {
			uncovered.add(folder);
		}
	}

	return [...uncovered].sort();
};
