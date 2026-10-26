import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getOwningPackage } from '#common/paths/getOwningPackage.ts';
import { getPackageSourceRoot } from '#common/paths/getPackageSourceRoot.ts';
import { getFolderSegments } from './getFolderSegments.ts';
import { isMainFile } from './isMainFile.ts';
import { judgePlacement } from './judgePlacement.ts';

export const check: StandardsCheckModule = {
	inputKinds: ['import-graph'],
	/**
	 * Judges every imported file from where its importers sit. Whether code
	 * used across subjects belongs to one subject or to none is the agent's to
	 * judge, which is why the rule has both kinds of check.
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

		const { files, referenceFiles, referenceTests, edges, dependencies } = input;
		const scope = new Set(files);
		const testFiles = new Set(referenceTests);
		const packageDirectories = [...dependencies.keys()];
		const importersOf = new Map<string, string[]>();
		const moduleFolders = new Set([...files, ...referenceFiles].filter((path) => isMainFile({ path })).map((path) => getFolderSegments({ path }).join('/')));

		for (const { from, to } of edges) {
			if (!testFiles.has(from) && getOwningPackage({ path: from, packageDirectories }) === getOwningPackage({ path: to, packageDirectories })) {
				importersOf.set(to, [...new Set([...(importersOf.get(to) ?? []), from])].sort());
			}
		}

		return referenceFiles.flatMap((path) => {
			const importers = importersOf.get(path) ?? [];

			if (importers.length === 0 || testFiles.has(path) || ![path, ...importers].some((file) => scope.has(file))) {
				return [];
			}

			const verdict = judgePlacement({ path, importers, moduleFolders, sourceRoot: getPackageSourceRoot({ path, packageDirectories }) });

			return verdict === undefined ? [] : [buildRawFinding({ rule: 'file-placement', files: [{ path }], ...verdict })];
		});
	},
};
