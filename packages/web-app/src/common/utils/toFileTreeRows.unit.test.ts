import { describe, expect, test } from '@jest/globals';
import { toFileTreeRows } from '#src/common/utils/toFileTreeRows.ts';

describe('toFileTreeRows', () => {
	test('lists each folder once, above what it holds, with how deep every row sits', () => {
		const rows = toFileTreeRows({ paths: ['src/index.ts', 'package.json', 'src/feature/a.ts', 'src/feature/b.ts'] });

		expect(rows.map(({ name, depth, path }) => [name, depth, path])).toStrictEqual([
			['package.json', 0, 'package.json'],
			['src', 0, undefined],
			['feature', 1, undefined],
			['a.ts', 2, 'src/feature/a.ts'],
			['b.ts', 2, 'src/feature/b.ts'],
			['index.ts', 1, 'src/index.ts'],
		]);
	});

	test('keys a folder apart from a file of the same name', () => {
		const rows = toFileTreeRows({ paths: ['src/src', 'src/src/a.ts'] });

		expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
	});
});
