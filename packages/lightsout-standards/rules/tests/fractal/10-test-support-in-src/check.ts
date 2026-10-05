import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '#common/checkInput/readPathLists.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { collectDirectories } from '#common/paths/collectDirectories.ts';
import { getBaseName } from '#common/paths/getBaseName.ts';
import { isUnderSrc } from '#common/paths/isUnderSrc.ts';

/**
 * The shared test-support folders the rule places outside `src/`. `helpers` is
 * absent because the folder-name rule already reports it, so one misplaced
 * folder never reports twice.
 */
const testSupportDirectories = new Set(['fixtures', 'mocks', '__mocks__', 'testUtils', 'test-utils']);

export const check: StandardsCheckModule = {
	inputKinds: ['file-list'],
	// One finding per folder rather than per file: the folder is what moves.
	run: ({ inputs }): RawStandardsFinding[] =>
		[...collectDirectories({ files: readPathLists({ input: inputs['file-list'] }).files })]
			.filter((directory) => testSupportDirectories.has(getBaseName({ path: directory })) && isUnderSrc({ path: directory }))
			.sort()
			.map((directory) =>
				buildRawFinding({
					rule: 'test-support-in-src',
					files: [{ path: directory }],
					detail: `test-support folder '${getBaseName({ path: directory })}' under src/`,
					guidance: "Move it to the package's `tests/` folder, outside `src/`.",
				}),
			),
};
