import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import type { StandardsPackFixture } from '#src/contracts/views/StandardsPackFixture.ts';
import { listFixtureFiles } from '#src/standardsLibraries/common/utils/listFixtureFiles.ts';

interface Params {
	fixturesPath: string;
}

/**
 * Each side is read recursively because it is a real source tree: a flat read
 * would drop a file the fixture was carved out into. A missing side yields no
 * entries rather than an error, since a built pack ships without its fixtures.
 *
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
