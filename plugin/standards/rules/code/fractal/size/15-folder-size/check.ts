import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getExportName } from '#common/naming/getExportName.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';

/** `types/` and `constants/` at the top of a `common/` hold files only, so they have no folder to group into. */
const isKindFolder = ({ directory }: { directory: string }) => {
	const name = getBaseName({ path: directory });

	return (name === 'types' || name === 'constants') && getBaseName({ path: getDirectory({ path: directory }) }) === 'common';
};

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// Tests are not counted: a test beside its subject is the convention working.
	// Barrels count, because the question is how long the listing has grown. A
	// module folder counts once in the folder that holds it, as the one module
	// it is: its main file carries the folder's name.
	run: ({ inputs, options }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input: inputs['file-list'] });
		const testPaths = new Set(tests);
		const countPerDirectory = new Map<string, number>();
		const { cap } = options;
		const addTo = ({ directory }: { directory: string }) => countPerDirectory.set(directory, (countPerDirectory.get(directory) ?? 0) + 1);

		for (const file of files.filter((path) => !testPaths.has(path))) {
			const directory = getDirectory({ path: file });

			addTo({ directory });

			if (directory !== '.' && getExportName({ path: file }) === getBaseName({ path: directory })) {
				addTo({ directory: getDirectory({ path: directory }) });
			}
		}

		return [...countPerDirectory]
			.filter(([directory, count]) => count > cap && !isKindFolder({ directory }))
			.map(([directory, count]) =>
				buildRawFinding({
					rule: 'folder-size',
					files: [{ path: directory }],
					detail: `${count} files in one flat folder (cap ~${cap})`,
					guidance: 'Group them into folders named for their subject.',
					measure: count,
				}),
			);
	},
};
