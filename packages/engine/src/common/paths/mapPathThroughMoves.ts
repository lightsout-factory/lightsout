import type { MoveDirection } from '#src/common/constants/MoveDirection.ts';
import { findCoveringMove } from '#src/common/paths/findCoveringMove.ts';

interface Params {
	path: string;
	/** File moves, exactly as `ParsedPlan.movePaths` holds them. */
	fileMoves: { from: string; to: string }[];
	/** Folder moves with no trailing `/`, exactly as `ParsedPlan.folderMoves` holds them. */
	folderMoves: { from: string; to: string }[];
	direction: MoveDirection;
}

/**
 * Sends a path forward from a move's source to its destination, or back the
 * other way, through the move `findCoveringMove` picks for it, so the mapping
 * and the choice of move never disagree. A folder move carries the rest of the
 * path past its prefix over to the other end.
 *
 * @returns the mapped path, or `path` itself when no move applies — a caller
 * tells "moved" from "not moved" by comparing the two
 */
export const mapPathThroughMoves = ({ path, fileMoves, folderMoves, direction }: Params): string => {
	const covering = findCoveringMove({ path, fileMoves, folderMoves, direction });

	return covering === undefined ? path : `${covering.target}${path.slice(covering.source.length)}`;
};
