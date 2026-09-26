import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import type { StandardsPackFixture } from '#src/contracts/views/StandardsPackFixture.ts';
import { listFixtureFiles } from '#src/standardsPacks/common/utils/listFixtureFiles.ts';

interface Params {
	fixturesPath: string;
}

/**
 * Every file of a rule's proof, both sides, with the text each holds.
 *
 * The two sides are read recursively because they are real source trees rather
 * than single files: `type-assertion`'s pass side is a payload reader plus the
 * named-constant file it was carved out into, and a flat read would show the
 * first and silently drop the carve-out the fixture exists to demonstrate.
 *
 * A missing side — or no `fixtures` folder at all — yields no entries rather
 * than an error, the same stance `getPlanDocument` takes towards a deleted plan.
 * A built pack ships without its fixtures, and that is a normal state a page
 * renders as "shipped without its fixtures".
 *
 * @param fixturesPath - absolute path of the rule folder's `fixtures` folder, which holds `pass/` and `fail/`
 * @returns pass-side files first, then fail-side, each side in path order
 */
export const readPackFixtures = async ({ fixturesPath }: Params): Promise<StandardsPackFixture[]> => {
	const fixtures: StandardsPackFixture[] = [];

	for (const side of [FixtureSide.Pass, FixtureSide.Fail]) {
		const sideRoot = join(fixturesPath, side);

		for (const path of await listFixtureFiles({ root: sideRoot })) {
			const text = await readFile(join(sideRoot, ...path.split('/')), 'utf8').catch(() => undefined);

			if (text !== undefined) {
				fixtures.push({ side, path, text });
			}
		}
	}

	return fixtures;
};
