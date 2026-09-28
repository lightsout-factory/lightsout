import { describe, expect, test } from '@jest/globals';
import { toFileTreeRows } from '#src/common/utils/toFileTreeRows.ts';

describe('toFileTreeRows', () => {
	test('lists each folder once, above what it holds, with how deep every row sits', () => {
		const rows = toFileTreeRows({ paths: ['src/index.ts', 'package.json', 'src/feature/a.ts', 'src/feature/b.ts'] });

		expect(rows.map(({ name, depth, path }) => [name, depth, path])).toStrictEqual([
			['src', 0, undefined],
			['feature', 1, undefined],
			['a.ts', 2, 'src/feature/a.ts'],
			['b.ts', 2, 'src/feature/b.ts'],
			['index.ts', 1, 'src/index.ts'],
			['package.json', 0, 'package.json'],
		]);
	});

	test('orders rows as an editor file explorer does: dot folders, then folders, then files', () => {
		const rows = toFileTreeRows({
			paths: ['README.md', 'src/b.ts', '.github/ci.yml', 'Zeta/z.ts', 'alpha/a.ts', '.env', 'file10.ts', 'file2.ts', 'Apple.ts'],
		});

		expect(rows.map((row) => row.key)).toStrictEqual([
			'.github/',
			'.github/ci.yml',
			'alpha/',
			'alpha/a.ts',
			'src/',
			'src/b.ts',
			'Zeta/',
			'Zeta/z.ts',
			'.env',
			'Apple.ts',
			'file2.ts',
			'file10.ts',
			'README.md',
		]);
	});

	test('keys a folder apart from a file of the same name', () => {
		const rows = toFileTreeRows({ paths: ['src/src', 'src/src/a.ts'] });

		expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
	});
});
