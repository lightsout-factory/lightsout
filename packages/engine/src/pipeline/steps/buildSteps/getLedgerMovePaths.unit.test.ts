import { describe, expect, test } from '@jest/globals';
import { getLedgerMovePaths } from '#src/pipeline/steps/buildSteps/getLedgerMovePaths.ts';

const setupCarriedTestFiles = () => {
	const movePaths = [
		{ from: 'src/a.unit.test.ts', to: 'lib/a.unit.test.ts' },
		{ from: 'src/b.ts', to: 'lib/b.ts' },
	];
	const folderMoves = [
		{ from: 'src/legacy', to: 'src/modern' },
		{ from: 'src/specs', to: 'tests/specs' },
	];
	const testFiles = ['src/modern/c.unit.test.ts', 'tests/specs/d.ts', 'src/unmoved/e.unit.test.ts', 'src/modern/f.ts'];

	return { movePaths, folderMoves, testFiles };
};

const setupRepeatedTestFiles = () => {
	const movePaths = [{ from: 'src/old/x.unit.test.ts', to: 'src/new/x.unit.test.ts' }];
	const folderMoves = [{ from: 'src/old', to: 'src/new' }];
	const testFiles = ['src/new/y.unit.test.ts', 'src/new/y.unit.test.ts', 'src/new/x.unit.test.ts'];

	return { movePaths, folderMoves, testFiles };
};

describe('getLedgerMovePaths', () => {
	test('getLedgerMovePaths: a ledger test file a folder move carries is paired with its source before the test-side filter', () => {
		const { movePaths, folderMoves, testFiles } = setupCarriedTestFiles();

		const pairs = getLedgerMovePaths({ movePaths, folderMoves, testFiles });

		expect(pairs).toStrictEqual([
			{ from: 'src/a.unit.test.ts', to: 'lib/a.unit.test.ts' },
			{ from: 'src/legacy/c.unit.test.ts', to: 'src/modern/c.unit.test.ts' },
			{ from: 'src/specs/d.ts', to: 'tests/specs/d.ts' },
		]);
	});

	test('getLedgerMovePaths: each carried test file is paired once', () => {
		const { movePaths, folderMoves, testFiles } = setupRepeatedTestFiles();

		const pairs = getLedgerMovePaths({ movePaths, folderMoves, testFiles });

		expect(pairs).toStrictEqual([
			{ from: 'src/old/x.unit.test.ts', to: 'src/new/x.unit.test.ts' },
			{ from: 'src/old/y.unit.test.ts', to: 'src/new/y.unit.test.ts' },
		]);
	});
});
