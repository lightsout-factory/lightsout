import { getExportName } from '#common/naming/getExportName.ts';
import { getFolderSegments } from './getFolderSegments.ts';

interface Params {
	/** A repo-relative path. */
	path: string;
}

/** A module folder's main file carries the folder's name: `listIssues/listIssues.ts`. */
export const isMainFile = ({ path }: Params): boolean => getExportName({ path }) === getFolderSegments({ path }).at(-1);
