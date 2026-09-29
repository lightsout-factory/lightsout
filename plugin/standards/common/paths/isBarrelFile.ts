import { getBaseName } from './getBaseName.ts';

/**
 * The JavaScript spellings count too: these rules judge paths rather than
 * types, so they run at full strength on a repo with no TypeScript in it.
 */
const barrelName = /^index\.(m|c)?[jt]sx?$/;

interface Params {
	/** A repo-relative file path. */
	path: string;
}

/**
 * The name alone. A caller that also needs the file to actually export
 * something states that as its own condition beside this one, because the two
 * are different questions: an `index.ts` that only imports and runs is an
 * entry point, which is a fact about the file's contents, not its name.
 */
export const isBarrelFile = ({ path }: Params): boolean => barrelName.test(getBaseName({ path }));
