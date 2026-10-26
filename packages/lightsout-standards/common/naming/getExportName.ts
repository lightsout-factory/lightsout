import { getBaseName } from '../paths/getBaseName.ts';

interface Params {
	/** A repo-relative path. */
	path: string;
}

/**
 * Derives the base name itself rather than reaching for `node:path`: a check
 * runs against supplied strings on any platform.
 */
export const getExportName = ({ path }: Params): string => getBaseName({ path }).replace(/\.(m|c)?[jt]sx?$/, '');
