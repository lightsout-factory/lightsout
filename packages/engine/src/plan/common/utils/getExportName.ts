import { basename } from 'node:path';

interface Params {
	/** A repo-relative path, or a bare filename. */
	path: string;
}

/**
 * A copy of the default standards package's `getExportName`, which must agree
 * with this but cannot be identical: a check derives the base name itself
 * rather than reaching for `node:path`. `scripts/checkMirrors.mjs` holds the
 * pair as a behavioural mirror, comparing what both return.
 */
export const getExportName = ({ path }: Params): string => basename(path).replace(/\.(m|c)?[jt]sx?$/, '');
