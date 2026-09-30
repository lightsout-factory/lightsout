import { type FileTextInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { readIntoCache } from '#src/standardsCheck/internal/common/checkInputs/readIntoCache.ts';

interface Params {
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	/** Repo-relative standards pack roots, from the walk that listed the files. */
	standardsLibraries: string[];
	/** The run's shared cache — read-through: a path is read from disk at most once per run. */
	cache: Map<string, string>;
}

/**
 * Every folder rather than a known list of package roots, because nothing here
 * has decided yet what a package is: a candidate that does not exist costs a
 * failed read, while a package missed costs every rule in it its aliases.
 */
const aliasSourceCandidates = ({ files }: { files: string[] }) => {
	const folders = new Set<string>();

	for (const file of files) {
		let cut = file.lastIndexOf('/');

		while (cut !== -1) {
			const folder = file.slice(0, cut);

			if (folders.has(folder)) {
				break;
			}

			folders.add(folder);
			cut = folder.lastIndexOf('/');
		}
	}

	return ['tsconfig.json', 'package.json', ...[...folders].flatMap((folder) => [`${folder}/tsconfig.json`, `${folder}/package.json`])];
};

/**
 * Every tsconfig.json and package.json above a file in scope is included,
 * because no rule may open them for itself: a package may declare its aliases
 * in either (`imports` or `compilerOptions.paths`), and aliases are per package
 * because a shared base config cannot name paths that mean a different folder
 * in each package that extends it.
 *
 * The cache is handed straight back as `contents` rather than copied per rule.
 */
export const buildFileTextInput = async ({ cwd, source, tests, files, referenceFiles, standardsLibraries, cache }: Params): Promise<FileTextInput> => {
	const inScope = [...new Set([...files, ...referenceFiles])];

	await readIntoCache({ cwd, paths: inScope, cache });
	await readIntoCache({ cwd, paths: aliasSourceCandidates({ files: inScope }), cache });

	return { kind: StandardsInputKind.FileText, cwd, source, tests, files, referenceFiles, contents: cache, standardsLibraries };
};
