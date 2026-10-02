import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';
import { isTestFile } from '#common/paths/isTestFile.ts';

/** An `internal/` folder is private to the folder above it, so a `common/` inside one serves that folder. */
const stripInternal = ({ segments }: { segments: string[] }) => (segments.at(-1) === 'internal' ? segments.slice(0, -1) : segments);

/** The folder a `common/` serves: everything above its last `common` segment, as a `/`-joined path, '' for the repo root. */
const servedFolder = ({ segments }: { segments: string[] }) => stripInternal({ segments: segments.slice(0, segments.lastIndexOf('common')) }).join('/');

/** The folders of `common/` that hold one kind of code; a file used only inside one belongs beside its users, in that same `common/`. */
const kindFolders = new Set(['utils', 'types', 'constants', 'services']);

/**
 * The folder whose `common/` should hold a file every one of `folders` uses:
 * the lowest folder holding them all. Users inside a kind folder of some
 * `common/` are served by that `common/`, so the file belongs beside them; a
 * domain folder, inside a `common/` or not, is a folder of its own.
 */
const lowestSharedFolder = ({ folders }: { folders: string[][] }) => {
	const [first = [], ...rest] = folders;
	const shared = first.filter((segment, index) => rest.every((folder) => folder[index] === segment));
	const commonAt = shared.lastIndexOf('common');
	const insideKindFolder = commonAt !== -1 && (shared[commonAt + 1] === undefined || kindFolders.has(shared[commonAt + 1] ?? ''));

	return insideKindFolder ? servedFolder({ segments: shared.slice(0, commonAt + 1) }) : stripInternal({ segments: shared }).join('/');
};

const isUnder = ({ path, folder }: { path: string; folder: string }) => folder === '' || path.startsWith(`${folder}/`);

/** The folder a file sits in, as segments; none for the repo root. */
const folderOf = ({ path }: { path: string }) => {
	const directory = getDirectory({ path });

	return directory === '.' ? [] : directory.split('/');
};

const owningPackage = ({ path, packageDirectories }: { path: string; packageDirectories: string[] }) =>
	packageDirectories.filter((directory) => directory === '.' || isUnder({ path, folder: directory })).sort((first, second) => second.length - first.length)[0];

const describeHome = ({ folder }: { folder: string }) => (folder === '' ? 'the repo root' : `'${folder}'`);

export const check: StandardsCheckModule = {
	inputKinds: ['import-graph'],
	/**
	 * Judges only files already in a `common/`, from where their importers sit:
	 * one outside the folder the `common/` serves means the file sits too low,
	 * and every importer under one child of that folder means it sits too high.
	 * Importers inside the file's own `common/` are its peers, wherever in it.
	 * Whether a file belongs in a `common/` at all, or is a module's own API, is
	 * the agent's to judge, which is why the rule is checked in part.
	 *
	 * A test is not a user: it tests the file where it is. An importer in
	 * another workspace package is that package's business, not a placement
	 * fact. A file nobody imports is `dead-export`'s. One finding per file,
	 * keyed on the file alone, so a new importer does not mint a new site.
	 */
	run: ({ inputs }): RawStandardsFinding[] => {
		const input = inputs['import-graph'];

		if (input === undefined) {
			return [];
		}

		const { files, referenceFiles, edges, dependencies, standardsLibraries } = input;
		const scope = new Set(files);
		const packageDirectories = [...dependencies.keys()];
		const importersOf = new Map<string, string[]>();

		for (const { from, to } of edges) {
			if (
				!isTestFile({ path: from, standardsLibraries }) &&
				owningPackage({ path: from, packageDirectories }) === owningPackage({ path: to, packageDirectories })
			) {
				importersOf.set(to, [...new Set([...(importersOf.get(to) ?? []), from])].sort());
			}
		}

		return referenceFiles.flatMap((path) => {
			const segments = folderOf({ path });
			const importers = importersOf.get(path) ?? [];

			if (
				!segments.includes('common') ||
				importers.length === 0 ||
				isTestFile({ path, standardsLibraries }) ||
				![path, ...importers].some((file) => scope.has(file))
			) {
				return [];
			}

			const served = servedFolder({ segments });
			const commonFolder = segments.slice(0, segments.lastIndexOf('common') + 1).join('/');
			const importerFolders = importers.map((importer) => folderOf({ path: importer }));
			const home = lowestSharedFolder({ folders: importerFolders });
			const outside = importers.filter((importer) => !isUnder({ path: importer, folder: served }));

			// Users all inside the file's own common/ are its peers: it is beside them already.
			if (home === served || importers.every((importer) => isUnder({ path: importer, folder: commonFolder }))) {
				return [];
			}

			return [
				buildRawFinding({
					rule: 'shared-code-placement',
					files: [{ path }],
					detail:
						outside.length > 0
							? `sits too low: ${outside.map((importer) => `'${importer}'`).join(', ')} ${outside.length > 1 ? 'use' : 'uses'} it from outside ${describeHome({ folder: served })}, and the lowest folder holding every user is ${describeHome({ folder: home })}`
							: `sits too high: every user (${importers.map((importer) => `'${importer}'`).join(', ')}) is under ${describeHome({ folder: home })}`,
					guidance: `Move it to the common/ of ${describeHome({ folder: home })}, the lowest folder that holds every file using it, and update the imports.`,
				}),
			];
		});
	},
};
