import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { collectDirectories } from '#common/paths/collectDirectories.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { getPackageSourceRoot } from '#common/paths/getPackageSourceRoot.ts';

/** The folder names a React tree sorts by kind. The layout keeps each kind in the file's name instead, so none of them is a folder. */
const kindLayerNames = new Set(['features', 'screens', 'components', 'hooks', 'queries']);

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// The five names are the code's to report. Whether a screen sits at its
	// feature's top level, or a feature reaches into another's common/, is the
	// agent's to judge, which is why the rule has both kinds of check.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files } = readPathLists({ input: inputs['file-list'] });
		const packageDirectories = [...(inputs['file-list']?.dependencies ?? new Map<string, string[]>()).keys()];

		return [...collectDirectories({ files })]
			.sort()
			.filter(
				(directory) =>
					directory.startsWith(getPackageSourceRoot({ path: directory, packageDirectories })) && kindLayerNames.has(getBaseName({ path: directory })),
			)
			.map((directory) =>
				buildRawFinding({
					rule: 'feature-layout',
					files: [{ path: directory }],
					detail: `folder '${getBaseName({ path: directory })}' is a layer named for a kind of code`,
					guidance:
						'Move its files up a level, beside the module that uses them, and let each file name say what it is: a Screen suffix, a QueryOptions suffix, a use prefix.',
				}),
			);
	},
};
