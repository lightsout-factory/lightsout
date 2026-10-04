import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getExportName } from '#common/naming/getExportName.ts';
import { collectDirectories } from '#common/paths/collectDirectories.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';
import { isUnderSrc } from '#common/paths/isUnderSrc.ts';

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// A folder is a module folder when a file in it carries its name. Tests are
	// not counted, since the main file's test moves with it. A folder holding
	// another folder is not down to one file, whatever that folder holds.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input: inputs['file-list'] });
		const testPaths = new Set(tests);
		const parentFolders = new Set([...collectDirectories({ files })].map((directory) => getDirectory({ path: directory })));
		const sourceFilesByFolder = new Map<string, string[]>();

		for (const file of files.filter((path) => !testPaths.has(path))) {
			const directory = getDirectory({ path: file });

			sourceFilesByFolder.set(directory, [...(sourceFilesByFolder.get(directory) ?? []), file]);
		}

		return [...sourceFilesByFolder]
			.filter(([directory, [only, ...others]]) => {
				const isOnlyMainFile = only !== undefined && others.length === 0 && getExportName({ path: only }) === getBaseName({ path: directory });

				return isOnlyMainFile && !parentFolders.has(directory) && isUnderSrc({ path: directory });
			})
			.map(([directory]) => directory)
			.sort()
			.map((directory) =>
				buildRawFinding({
					rule: 'module-file-to-folder',
					files: [{ path: directory }],
					detail: `folder '${getBaseName({ path: directory })}' holds only its main file`,
					guidance: 'Turn the module back into a file: move the main file, and its test, up one folder and delete this one.',
				}),
			);
	},
};
