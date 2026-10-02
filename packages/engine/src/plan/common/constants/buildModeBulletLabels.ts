import { BuildMode } from '#src/common/constants/BuildMode.ts';

/**
 * The overview declaration-block bullet that reads `yes` for each mechanical
 * build mode. The parser, the renderer and every finding that names a bullet
 * spell it from here, so a reworded label cannot leave the parser unable to read
 * the blocks the mechanical repair writes.
 */
export const buildModeBulletLabels: Record<Exclude<BuildMode, typeof BuildMode.Standard>, string> = {
	[BuildMode.RenamesOnly]: 'Renames only',
	[BuildMode.MoveFoldersAndFiles]: 'Moves folders and files only',
};
