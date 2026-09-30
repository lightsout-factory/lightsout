import { getBaseName } from '../paths/getBaseName.ts';

interface Params {
	/** A repo-relative path. */
	path: string;
}

/**
 * The engine keeps a copy of this that must AGREE, but cannot be identical: it
 * reaches for `node:path`, and a check runs against supplied strings on any
 * platform, so this one derives the base name itself. `scripts/checkMirrors.mjs`
 * therefore holds the pair by behaviour rather than by code — both copies are
 * run over the same inputs and their answers compared.
 */
export const getExportName = ({ path }: Params): string => getBaseName({ path }).replace(/\.(m|c)?[jt]sx?$/, '');
