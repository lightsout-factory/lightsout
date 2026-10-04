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
 * Finds the move that carries a path forward from its source, or back from its
 * destination. A file move matches only exactly and a folder move only by a
 * `/`-aligned prefix, so `src/legacy-extra/` never reads as under `src/legacy`.
 * When moves overlap, which the lint reports, an exact file match wins and then
 * the longest folder prefix, so the answer stays deterministic.
 *
 * @returns the move's ends in the direction asked, `source` being the end the
 * path sits under, or `undefined` when no move covers the path
 */
export const findCoveringMove = ({ path, fileMoves, folderMoves, direction }: Params): { source: string; target: string; isFolder: boolean } | undefined => {
	const fileMatch = fileMoves.map((move) => endsOf({ move, direction })).find(({ source }) => source === path);
	const folderMatch = folderMoves
		.map((move) => endsOf({ move, direction }))
		.filter(({ source }) => path.startsWith(`${source}/`))
		.sort((left, right) => right.source.length - left.source.length)[0];
	let covering: { source: string; target: string; isFolder: boolean } | undefined;

	if (fileMatch !== undefined) {
		covering = { ...fileMatch, isFolder: false };
	} else if (folderMatch !== undefined) {
		covering = { ...folderMatch, isFolder: true };
	}

	return covering;
};
