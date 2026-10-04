import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { listFixtureFiles } from '#src/common/listFixtureFiles.ts';

/** One fixture side on disk holding the given files. */
const setupFixtureSide = ({ files }: { files: string[] }) => {
	const root = join(mkdtempSync(join(tmpdir(), 'lightsout-side-')), 'pass');

	for (const file of files) {
		mkdirSync(dirname(join(root, file)), { recursive: true });
		writeFileSync(join(root, file), '');
	}

	return { root };
};

describe('listFixtureFiles', () => {
	test('lists every file under the side, nested ones included, as sorted relative paths', async () => {
		const { root } = setupFixtureSide({ files: ['src/feature/b.ts', 'package.json', 'src/a.ts'] });

		const files = await listFixtureFiles({ root });

		expect(files).toStrictEqual(['package.json', 'src/a.ts', 'src/feature/b.ts']);
	});

	test('lists nothing for a side that does not exist, as a built pack ships none', async () => {
		const files = await listFixtureFiles({ root: join(tmpdir(), 'lightsout-no-such-side') });

		expect(files).toStrictEqual([]);
	});
});
