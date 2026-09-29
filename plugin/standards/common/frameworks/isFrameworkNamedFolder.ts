import { getBaseName } from '../paths/getBaseName.ts';
import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';
import { getSourceRoot } from './getSourceRoot.ts';

interface Params {
	/** A repo-relative folder path. */
	folder: string;
	/** The carve-out of the package that governs this folder. */
	carveOut: FrameworkCarveOut;
}

/**
 * No framework in the carve-out table fills `exemptFolderNames` yet, so this
 * answers `no` everywhere until a real mandate appears; it stays so a framework
 * that does mandate a name is one table entry away.
 *
 * Matched inside the governing package's `src/` only, so a repo's fixture trees
 * and test helpers cannot pick up a mandate meant for source.
 */
export const isFrameworkNamedFolder = ({ folder, carveOut }: Params): boolean =>
	folder.startsWith(getSourceRoot({ carveOut })) && carveOut.exemptFolderNames.includes(getBaseName({ path: folder }));
