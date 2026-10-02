/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { listSharedCode } from '#src/common/sharedCode/listSharedCode.ts';

/** A temp repo holding the named files, each with a line of source. */
const setupRepo = async ({ files }: { files: string[] }) => {
	const cwd = await mkdtemp(join(tmpdir(), 'lightsout-shared-code-'));

	for (const path of files) {
		await mkdir(dirname(join(cwd, path)), { recursive: true });
		await writeFile(join(cwd, path), 'export const value = 1;\n', 'utf8');
	}

	return { cwd };
};

describe('listSharedCode', () => {
	test('reads the shared code on the way up from the work files off the tree', async () => {
		const { cwd } = await setupRepo({ files: ['src/common/utils/formatDate.ts', 'src/billing/common/utils/formatMoney.ts', 'src/billing/getTotal.ts'] });

		const found = await listSharedCode({ cwd, config: {}, workFiles: ['src/billing/getTotal.ts'] });

		expect(found).toStrictEqual([
			{ path: 'src/billing/common', groups: [{ folder: 'utils', names: ['formatMoney'] }] },
			{ path: 'src/common', groups: [{ folder: 'utils', names: ['formatDate'] }] },
		]);
	});

	test('leaves out tests, and what the config calls generated or vendored — none of it is shared code to reuse', async () => {
		const { cwd } = await setupRepo({
			files: [
				'src/common/utils/formatDate.ts',
				'src/common/utils/formatDate.unit.test.ts',
				'src/common/generated/schema.ts',
				'src/common/ui/Button.tsx',
				'src/common/notes.md',
			],
		});

		const found = await listSharedCode({
			cwd,
			config: { generated: ['src/common/generated/'], vendored: ['src/common/ui/'] },
			workFiles: ['src/index.ts'],
		});

		expect(found).toStrictEqual([{ path: 'src/common', groups: [{ folder: 'utils', names: ['formatDate'] }] }]);
	});

	test('finds nothing, and reads nothing, when there are no work files to look from', async () => {
		const found = await listSharedCode({ cwd: join(tmpdir(), 'lightsout-shared-code-missing'), config: {}, workFiles: [] });

		expect(found).toStrictEqual([]);
	});
});
