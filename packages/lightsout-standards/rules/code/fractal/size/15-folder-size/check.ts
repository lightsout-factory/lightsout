import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getDirectory } from '#common/paths/getDirectory.ts';

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// Tests are not counted: a test beside its subject is the convention working.
	// Barrels count, because the question is how long the listing has grown.
	run: ({ inputs, options }): RawStandardsFinding[] => {
		const { files, tests } = readPathLists({ input: inputs['file-list'] });
		const testPaths = new Set(tests);
		const filesPerDirectory = new Map<string, string[]>();
		const { cap } = options;

		for (const file of files) {
			if (!testPaths.has(file)) {
				const directory = getDirectory({ path: file });

				filesPerDirectory.set(directory, [...(filesPerDirectory.get(directory) ?? []), file]);
			}
		}

		return [...filesPerDirectory]
			.filter(([, paths]) => paths.length > cap)
			.map(([directory, paths]) =>
				buildRawFinding({
					rule: 'folder-size',
					files: [{ path: directory }],
					detail: `${paths.length} files in one flat folder (cap ~${cap})`,
					guidance: 'Group them by domain, or graduate the concepts hiding in the pile.',
					measure: paths.length,
				}),
			);
	},
};
