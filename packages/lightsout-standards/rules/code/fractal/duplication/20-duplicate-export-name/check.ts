import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getExportName } from '#common/naming/getExportName.ts';
import { getOwningPackage } from '#common/paths/getOwningPackage.ts';

/**
 * Tests are left out: a test file is named after the subject it covers, so two
 * of them under one name is the convention working. Names are compared within
 * one package, since two packages may be unable to share code.
 */
const groupByName = ({ files, tests, packageDirectories }: { files: string[]; tests: string[]; packageDirectories: string[] }) => {
	const testPaths = new Set(tests);
	const byName = new Map<string, { name: string; paths: string[] }>();

	for (const file of files) {
		const name = getExportName({ path: file });

		// Every folder-module has an index, so the name says nothing about what
		// the file holds.
		if (!testPaths.has(file) && name !== 'index') {
			const key = `${getOwningPackage({ path: file, packageDirectories })}:${name}`;

			byName.set(key, { name, paths: [...(byName.get(key)?.paths ?? []), file] });
		}
	}

	return byName;
};

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// Tier 0 of the duplication ladder: one export per file makes a filename an
	// export name, so name-level comparison is nearly free and runs before any
	// file is opened.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input: inputs['file-list'] });
		const packageDirectories = [...(inputs['file-list']?.dependencies ?? new Map<string, string[]>()).keys()];

		return [...groupByName({ files, tests, packageDirectories }).values()]
			.filter(({ paths }) => paths.length > 1)
			.map(({ name, paths }) =>
				buildRawFinding({
					rule: 'duplicate-export-name',
					files: paths.map((path) => ({ path })),
					detail: `'${name}' is declared in ${paths.length} places`,
					guidance: 'Keep one and share it, or rename the one that is a different thing.',
				}),
			);
	},
};
