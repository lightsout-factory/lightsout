import { MoveDirection } from '#src/common/constants/MoveDirection.ts';

interface Params {
	path: string;
	/** File moves, exactly as `ParsedPlan.movePaths` holds them. */
	fileMoves: { from: string; to: string }[];
	/** Folder moves with no trailing `/`, exactly as `ParsedPlan.folderMoves` holds them. */
	folderMoves: { from: string; to: string }[];
	direction: MoveDirection;
}

const endsOf = ({ move, direction }: { move: { from: string; to: string }; direction: MoveDirection }) =>
	direction === MoveDirection.Forward ? { source: move.from, target: move.to } : { source: move.to, target: move.from };

/**
 * Sends a path forward from a move's source to its destination, or back the
 * other way. A file move matches only exactly and a folder move only by a
 * `/`-aligned prefix, so `src/legacy-extra/` never reads as under `src/legacy`.
 * When moves overlap, which the lint reports, an exact file match wins and then
 * the longest folder prefix, so the answer stays deterministic.
 *
 * @returns the mapped path, or `path` itself when no move applies — a caller
 * tells "moved" from "not moved" by comparing the two
 */
export const mapPathThroughMoves = ({ path, fileMoves, folderMoves, direction }: Params): string => {
	const fileMatch = fileMoves.map((move) => endsOf({ move, direction })).find(({ source }) => source === path);
	const folderMatch = folderMoves
		.map((move) => endsOf({ move, direction }))
		.filter(({ source }) => path.startsWith(`${source}/`))
		.sort((left, right) => right.source.length - left.source.length)[0];
	let mapped = path;

	if (fileMatch !== undefined) {
		mapped = fileMatch.target;
	} else if (folderMatch !== undefined) {
		mapped = `${folderMatch.target}${path.slice(folderMatch.source.length)}`;
	}

	return mapped;
};
