import { describe, expect, test } from '@jest/globals';
import { findSharedCode } from '#src/common/sharedCode/findSharedCode.ts';

/** A repo with shared code at three levels, a sibling feature's own, and the private and nested corners the listing has to leave alone. */
const sourceFiles = [
	'src/common/constants/Action.ts',
	'src/common/utils/formatDate.ts',
	'src/common/utils/loadConfig.ts',
	'src/billing/common/utils/formatMoney.ts',
	'src/billing/invoices/common/types/Invoice.ts',
	'src/billing/invoices/getInvoice.ts',
	'src/shipping/common/utils/formatAddress.ts',
];

describe('findSharedCode', () => {
	test('lists every common folder on the way up from a work file, nearest first', () => {
		const found = findSharedCode({ sourceFiles, workFiles: ['src/billing/invoices/getInvoice.ts'] });

		expect(found).toStrictEqual([
			{ path: 'src/billing/invoices/common', groups: [{ folder: 'types', names: ['Invoice'] }] },
			{ path: 'src/billing/common', groups: [{ folder: 'utils', names: ['formatMoney'] }] },
			{
				path: 'src/common',
				groups: [
					{ folder: 'constants', names: ['Action'] },
					{ folder: 'utils', names: ['formatDate', 'loadConfig'] },
				],
			},
		]);
	});

	test('leaves out a sibling folder’s common, which serves that sibling alone', () => {
		const found = findSharedCode({ sourceFiles, workFiles: ['src/billing/getTotal.ts'] });

		expect(found.map(({ path }) => path)).toStrictEqual(['src/billing/common', 'src/common']);
	});

	test('looks from a file the work will create, in a folder that does not exist yet', () => {
		const found = findSharedCode({ sourceFiles, workFiles: ['src/billing/refunds/internal/buildRefund.ts'] });

		expect(found.map(({ path }) => path)).toStrictEqual(['src/billing/common', 'src/common']);
	});

	test('joins what several work files reach, each folder once', () => {
		const found = findSharedCode({ sourceFiles, workFiles: ['src/billing/getTotal.ts', 'src/shipping/getRate.ts', 'src/billing/getTax.ts'] });

		expect(found.map(({ path }) => path)).toStrictEqual(['src/billing/common', 'src/shipping/common', 'src/common']);
	});

	test('includes the common of a folder’s own internal, which any file inside that folder may import', () => {
		const found = findSharedCode({
			sourceFiles: ['src/billing/internal/common/utils/roundCents.ts', 'src/shipping/internal/common/utils/roundWeight.ts'],
			workFiles: ['src/billing/invoices/getInvoice.ts'],
		});

		expect(found).toStrictEqual([{ path: 'src/billing/internal/common', groups: [{ folder: 'utils', names: ['roundCents'] }] }]);
	});

	test('leaves out what sits below a nested internal or a nested common, which belongs to the folder holding it', () => {
		const found = findSharedCode({
			sourceFiles: [
				'src/common/git/readHead.ts',
				'src/common/git/internal/parseRef.ts',
				'src/common/git/common/utils/trimRef.ts',
				'src/common/utils/loadConfig/loadConfig.ts',
				'src/common/utils/loadConfig/internal/readFile.ts',
			],
			workFiles: ['src/index.ts'],
		});

		expect(found).toStrictEqual([
			{
				path: 'src/common',
				groups: [
					{ folder: 'git', names: ['readHead'] },
					{ folder: 'utils/loadConfig', names: ['loadConfig'] },
				],
			},
		]);
	});

	test('reaches a nested common from a work file inside the folder that holds it', () => {
		const found = findSharedCode({
			sourceFiles: ['src/common/git/readHead.ts', 'src/common/git/common/utils/trimRef.ts'],
			workFiles: ['src/common/git/readTag.ts'],
		});

		expect(found.map(({ path }) => path)).toStrictEqual(['src/common/git/common', 'src/common']);
	});

	test('groups a file sitting directly in a common folder under no folder name, and names each file without its extension', () => {
		const found = findSharedCode({ sourceFiles: ['src/common/helpers.ts', 'src/common/components/Button.tsx'], workFiles: ['src/App.tsx'] });

		expect(found).toStrictEqual([
			{
				path: 'src/common',
				groups: [
					{ folder: '', names: ['helpers'] },
					{ folder: 'components', names: ['Button'] },
				],
			},
		]);
	});

	test('finds a common folder at the repo root, and one in a monorepo package, from a file in that package', () => {
		const found = findSharedCode({
			sourceFiles: ['common/utils/atRoot.ts', 'packages/engine/src/common/utils/inEngine.ts', 'packages/web/src/common/utils/inWeb.ts'],
			workFiles: ['packages/engine/src/run.ts'],
		});

		expect(found.map(({ path }) => path)).toStrictEqual(['packages/engine/src/common', 'common']);
	});

	test('does not mistake a file named common for a folder', () => {
		const found = findSharedCode({ sourceFiles: ['src/common.ts', 'src/billing/common'], workFiles: ['src/billing/getTotal.ts'] });

		expect(found).toStrictEqual([]);
	});

	test.each([{ workFiles: [] }, { workFiles: ['docs/readme.ts'] }])(
		'finds nothing when there is nowhere to look from, or nothing shared on the way up',
		({ workFiles }) => {
			const found = findSharedCode({ sourceFiles, workFiles });

			expect(found).toStrictEqual([]);
		},
	);
});
