import type { FileTextInput, ImportGraphInput, RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '#common/checkInput/readFileTexts.ts';
import { readPackageEntries } from '#common/checkInput/readPackageEntries.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { isPackageEntry } from '#common/modules/isPackageEntry.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';
import { getTestSubject } from '#common/paths/getTestSubject.ts';
import { isBarrelFile } from '#common/paths/isBarrelFile.ts';
import { isOutsideEveryPackage } from '#common/paths/isOutsideEveryPackage.ts';

const getOwningPackage = ({ path, packageDirectories }: { path: string; packageDirectories: string[] }) =>
	packageDirectories.filter((directory) => directory === '.' || path.startsWith(`${directory}/`)).sort((first, second) => second.length - first.length)[0];

/**
 * Every index file one importer names is one finding, since the fix is a
 * single edit to its imports. An index file may still re-export from another,
 * its own test may import it, and another package's entry is that package's
 * public API.
 *
 * An importer belonging to no package is skipped, since where a package keeps
 * its folders is its own business; a repo declaring no workspace package is
 * itself the package.
 */
const findImportsThroughIndex = ({ input }: { input: ImportGraphInput | undefined }): RawStandardsFinding[] => {
	if (input === undefined) {
		return [];
	}

	const { files, referenceFiles, edges, dependencies } = input;
	const packageDirectories = [...dependencies.keys()];
	const referenceSet = new Set(referenceFiles);
	const scope = new Set(files);
	const barrelsByImporter = new Map<string, string[]>();

	for (const { from, to } of edges) {
		if (
			scope.has(from) &&
			!isOutsideEveryPackage({ path: from, packageDirectories }) &&
			isBarrelFile({ path: to }) &&
			!isBarrelFile({ path: from }) &&
			getTestSubject({ test: from, files: referenceSet }) !== to &&
			getOwningPackage({ path: from, packageDirectories }) === getOwningPackage({ path: to, packageDirectories })
		) {
			const barrels = barrelsByImporter.get(from) ?? [];

			barrelsByImporter.set(from, barrels.includes(to) ? barrels : [...barrels, to]);
		}
	}

	return [...barrelsByImporter].map(([from, barrels]) =>
		buildRawFinding({
			rule: 'index-files',
			files: [{ path: from }, ...barrels.map((path) => ({ path }))],
			detail: `imports through ${barrels.map((path) => `'${path}'`).join(', ')} — import each name from the file that declares it instead`,
			guidance: 'An index file lists what a package makes public; nothing inside the package imports through it.',
		}),
	);
};

/**
 * Every import names the file that declares it, so an index file inside a
 * package lists names nothing reads through it. A package's entry is the
 * exception, because other packages do read through it.
 *
 * File text rather than a path list, because which files a package publishes
 * is written in its manifest, and only this input carries it.
 */
const findFolderIndexFiles = ({ input }: { input: FileTextInput | undefined }): RawStandardsFinding[] => {
	const { files, contents } = readFileTexts({ input });
	const entries = readPackageEntries({ contents });

	return files
		.filter((path) => isBarrelFile({ path }) && !isPackageEntry({ path, entries }))
		.map((path) =>
			buildRawFinding({
				rule: 'index-files',
				files: [{ path }],
				detail: `an index file in ${getDirectory({ path })}, which is no package entry`,
				guidance: 'Every import names the file that declares it, so a folder index lists names nothing reads — delete it.',
			}),
		);
};

export const check: StandardsCheckModule = {
	inputKinds: ['import-graph', 'file-text'],
	/** The graph says who imports through an index file; the file text says which index files are no package entry. */
	run: ({ inputs }): RawStandardsFinding[] => [
		...findImportsThroughIndex({ input: inputs['import-graph'] }),
		...findFolderIndexFiles({ input: inputs['file-text'] }),
	],
};
