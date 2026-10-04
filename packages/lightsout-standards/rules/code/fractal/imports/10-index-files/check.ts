import type { ImportGraphInput, RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '#common/checkInput/readFileTexts.ts';
import { readPackageEntries } from '#common/checkInput/readPackageEntries.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { isPackageEntry } from '#common/modules/isPackageEntry.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';
import { getOwningPackage } from '#common/paths/getOwningPackage.ts';
import { getTestSubject } from '#common/paths/getTestSubject.ts';
import { isIndexFile } from '#common/paths/isIndexFile.ts';
import { isOutsideEveryPackage } from '#common/paths/isOutsideEveryPackage.ts';
import type { PackageEntries } from '#common/types/PackageEntries.ts';

const quote = ({ paths }: { paths: string[] }) => paths.map((path) => `'${path}'`).join(', ');

/** Each importer in `edges` with the distinct files it imports, in the order they first appear. */
const groupByImporter = ({ edges }: { edges: Array<{ from: string; to: string }> }) => {
	const targetsByImporter = new Map<string, string[]>();

	for (const { from, to } of edges) {
		const targets = targetsByImporter.get(from) ?? [];

		targetsByImporter.set(from, targets.includes(to) ? targets : [...targets, to]);
	}

	return targetsByImporter;
};

interface ImporterFindingsParams {
	edges: Array<{ from: string; to: string }>;
	describe: (params: { targets: string[] }) => string;
	guidance: string;
}

/** One finding per importer, listing the importer first and then every file it wrongly imports. */
const buildImporterFindings = ({ edges, describe, guidance }: ImporterFindingsParams): RawStandardsFinding[] =>
	[...groupByImporter({ edges })].map(([from, targets]) =>
		buildRawFinding({ rule: 'index-files', files: [{ path: from }, ...targets.map((path) => ({ path }))], detail: describe({ targets }), guidance }),
	);

/**
 * Every index file one importer names is one finding, since the fix is a
 * single edit to its imports, and so is every file it reaches inside another
 * package. An index file may still re-export from another, its own test may
 * import it, and another package's entry is that package's public API.
 *
 * An importer belonging to no package is skipped, since where a package keeps
 * its folders is its own business; a repo declaring no workspace package is
 * itself the package.
 */
const findWrongImports = ({ input, entryFiles }: { input: ImportGraphInput | undefined; entryFiles: Set<string> }): RawStandardsFinding[] => {
	if (input === undefined) {
		return [];
	}

	const { files, referenceFiles, edges, dependencies } = input;
	const packageDirectories = [...dependencies.keys()];
	const referenceSet = new Set(referenceFiles);
	const scope = new Set(files);
	const judged = edges.filter(({ from }) => scope.has(from) && !isOutsideEveryPackage({ path: from, packageDirectories }));
	const isSamePackage = ({ from, to }: { from: string; to: string }) =>
		getOwningPackage({ path: from, packageDirectories }) === getOwningPackage({ path: to, packageDirectories });
	const throughIndex = judged.filter(
		({ from, to }) =>
			isIndexFile({ path: to }) && !isIndexFile({ path: from }) && getTestSubject({ test: from, files: referenceSet }) !== to && isSamePackage({ from, to }),
	);
	const intoAnotherPackage = judged.filter(
		({ from, to }) =>
			!isSamePackage({ from, to }) && !isOutsideEveryPackage({ path: to, packageDirectories }) && !isIndexFile({ path: to }) && !entryFiles.has(to),
	);

	return [
		...buildImporterFindings({
			edges: throughIndex,
			describe: ({ targets }) => `imports through ${quote({ paths: targets })} — import each name from the file that declares it instead`,
			guidance: 'An index file lists what a package makes public; nothing inside the package imports through it.',
		}),
		...buildImporterFindings({
			edges: intoAnotherPackage,
			describe: ({ targets }) => `imports ${quote({ paths: targets })} from inside another package`,
			guidance: "Import it from that package's entry, never by a path into its files.",
		}),
	];
};

/**
 * Every import names the file that declares it, so an index file inside a
 * package lists names nothing reads through it. A package's entry is the
 * exception, because other packages do read through it.
 *
 */
const findFolderIndexFiles = ({ files, entries }: { files: string[]; entries: PackageEntries }): RawStandardsFinding[] => {
	return files
		.filter((path) => isIndexFile({ path }) && !isPackageEntry({ path, entries }))
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
	/** The graph says who imports what; the file text carries the manifests, which say which files a package publishes. */
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, contents } = readFileTexts({ input: inputs['file-text'] });
		const entries = readPackageEntries({ contents });

		return [...findWrongImports({ input: inputs['import-graph'], entryFiles: entries.entryFiles }), ...findFolderIndexFiles({ files, entries })];
	},
};
