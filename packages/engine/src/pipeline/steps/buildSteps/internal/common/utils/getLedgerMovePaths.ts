import { MoveDirection } from '#src/common/constants/MoveDirection.ts';
import { mapPathThroughMoves } from '#src/common/mapPathThroughMoves.ts';
import { isTestSideFile } from '#src/pipeline/common/isTestSideFile.ts';

interface Params {
	/** The plan's file moves. */
	movePaths: { from: string; to: string }[];
	/** The plan's folder moves, with no trailing `/`. */
	folderMoves: { from: string; to: string }[];
	/** The ledger rows' test files. */
	testFiles: string[];
}

/**
 * The ledger writer finds a test file's committed source by exact match on a
 * move's `to`, and at build time a folder move is unexpanded, so each ledger
 * test file a folder move carries is paired with its source here. The test-side
 * filter runs only after that mapping: a move destination the ledger writer
 * writes carries every case its source held.
 */
export const getLedgerMovePaths = ({ movePaths, folderMoves, testFiles }: Params): { from: string; to: string }[] => {
	const pairs = [...movePaths];

	for (const testFile of new Set(testFiles)) {
		const source = mapPathThroughMoves({ path: testFile, fileMoves: [], folderMoves, direction: MoveDirection.Back });

		if (source !== testFile && !pairs.some(({ to }) => to === testFile)) {
			pairs.push({ from: source, to: testFile });
		}
	}

	return pairs.filter(({ to }) => isTestSideFile({ path: to }));
};
