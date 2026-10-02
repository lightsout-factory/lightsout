import type { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { RenameRule } from '#src/contracts/plan/renames/RenameRule.ts';

/**
 * A phase's build mode as the pipeline carries it: the mode, with the data its
 * checkpoint judgment needs. Folder moves carry no trailing `/`, exactly as the
 * parsed plan holds them.
 */
export type PlanBuildMode =
	| { buildMode: typeof BuildMode.Standard }
	| { buildMode: typeof BuildMode.RenamesOnly; renames: RenameRule[] }
	| { buildMode: typeof BuildMode.MoveFoldersAndFiles; fileMoves: { from: string; to: string }[]; folderMoves: { from: string; to: string }[] };
