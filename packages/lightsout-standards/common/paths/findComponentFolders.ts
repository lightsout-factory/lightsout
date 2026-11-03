import { getExportName } from '../naming/getExportName.ts';
import { getBaseName } from './getBaseName.ts';
import { getDirectory } from './getDirectory.ts';

interface Params {
	/** Repo-relative source paths, tests left out. */
	files: string[];
}

/** Every folder holding a file of its own name: a component folder, or any module folder, is told from a group this way. */
export const findComponentFolders = ({ files }: Params): Set<string> =>
	new Set(
		files.filter((file) => getExportName({ path: file }) === getBaseName({ path: getDirectory({ path: file }) })).map((file) => getDirectory({ path: file })),
	);
