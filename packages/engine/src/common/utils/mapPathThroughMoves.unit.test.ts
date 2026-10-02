import { describe, expect, test } from '@jest/globals';
import { MoveDirection } from '#src/common/constants/MoveDirection.ts';
import { mapPathThroughMoves } from '#src/common/utils/mapPathThroughMoves.ts';

const setupMoves = () => {
	const fileMoves = [{ from: 'src/old.ts', to: 'src/new.ts' }];
	const folderMoves = [{ from: 'src/legacy', to: 'pkg/modern' }];

	return { fileMoves, folderMoves };
};

const setupOverlappingMoves = () => {
	const fileMoves = [{ from: 'src/legacy/special.ts', to: 'lib/special.ts' }];
	const folderMoves = [
		{ from: 'src/legacy', to: 'pkg/modern' },
		{ from: 'src/legacy/deep', to: 'vendor/deep' },
	];

	return { fileMoves, folderMoves };
};

describe('mapPathThroughMoves', () => {
	test('mapPathThroughMoves: maps forward by exact file match or slash-aligned folder prefix, and leaves a name-prefix-only or unmoved path unchanged', () => {
		const { fileMoves, folderMoves } = setupMoves();
		const paths = ['src/old.ts', 'src/legacy/a/b.ts', 'src/legacy-extra/c.ts', 'src/untouched.ts'];

		const mapped = paths.map((path) => mapPathThroughMoves({ path, fileMoves, folderMoves, direction: MoveDirection.Forward }));

		expect(mapped).toStrictEqual(['src/new.ts', 'pkg/modern/a/b.ts', 'src/legacy-extra/c.ts', 'src/untouched.ts']);
	});

	test('mapPathThroughMoves: maps a destination back to its source through file and folder moves', () => {
		const { fileMoves, folderMoves } = setupMoves();
		const paths = ['src/new.ts', 'pkg/modern/a/b.ts', 'pkg/modernist/c.ts', 'src/legacy/a/b.ts'];

		const mapped = paths.map((path) => mapPathThroughMoves({ path, fileMoves, folderMoves, direction: MoveDirection.Back }));

		expect(mapped).toStrictEqual(['src/old.ts', 'src/legacy/a/b.ts', 'pkg/modernist/c.ts', 'src/legacy/a/b.ts']);
	});

	test('mapPathThroughMoves: an exact file move wins over a folder prefix, and the longest folder prefix wins over a shorter one', () => {
		const { fileMoves, folderMoves } = setupOverlappingMoves();
		const paths = ['src/legacy/special.ts', 'src/legacy/deep/x.ts', 'src/legacy/shallow.ts'];

		const mapped = paths.map((path) => mapPathThroughMoves({ path, fileMoves, folderMoves, direction: MoveDirection.Forward }));

		expect(mapped).toStrictEqual(['lib/special.ts', 'vendor/deep/x.ts', 'pkg/modern/shallow.ts']);
	});
});
