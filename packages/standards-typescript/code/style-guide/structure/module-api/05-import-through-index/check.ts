import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getFrameworkCarveOuts } from '#common/frameworks/getFrameworkCarveOuts.ts';
import { getPathCarveOut } from '#common/frameworks/getPathCarveOut.ts';
import { isFrameworkLoadedFile } from '#common/frameworks/isFrameworkLoadedFile.ts';
import { getTestSubject } from '#common/paths/getTestSubject.ts';
import { isBarrelFile } from '#common/paths/isBarrelFile.ts';
import { isOutsideEveryPackage } from '#common/paths/isOutsideEveryPackage.ts';

const getOwningPackage = ({ path, packageDirectories }: { path: string; packageDirectories: string[] }) =>
	packageDirectories.filter((directory) => directory === '.' || path.startsWith(`${directory}/`)).sort((first, second) => second.length - first.length)[0];

export const check: StandardsCheckModule = {
	inputKind: 'import-graph',
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
	run: ({ input }): RawStandardsFinding[] => {
		if (input.kind !== 'import-graph') {
			return [];
		}

		const { files, referenceFiles, edges, dependencies } = input;
		const carveOuts = getFrameworkCarveOuts({ dependencies });
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
				!isFrameworkLoadedFile({ path: to, carveOut: getPathCarveOut({ carveOuts, path: to }) }) &&
				getTestSubject({ test: from, files: referenceSet }) !== to &&
				getOwningPackage({ path: from, packageDirectories }) === getOwningPackage({ path: to, packageDirectories })
			) {
				const barrels = barrelsByImporter.get(from) ?? [];

				barrelsByImporter.set(from, barrels.includes(to) ? barrels : [...barrels, to]);
			}
		}

		return [...barrelsByImporter].map(([from, barrels]) =>
			buildRawFinding({
				rule: 'import-through-index',
				files: [{ path: from }, ...barrels.map((path) => ({ path }))],
				detail: `imports through ${barrels.map((path) => `'${path}'`).join(', ')} — import each name from the file that declares it instead`,
				guidance: 'An index file lists what a package makes public; nothing inside the package imports through it.',
			}),
		);
	},
};
