import { getDirectory } from './getDirectory.ts';
import { getTestSubjectName } from './getTestSubjectName.ts';

/**
 * Every source extension a subject may carry. Restricting this to TypeScript
 * would report every co-located test in a JS-only repo as misplaced — and these
 * rules run at full strength on those repos, since they read paths rather than
 * types.
 */
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

interface Params {
	/** Repo-relative path of a test file. */
	test: string;
	/** Every file in scope — the subject is looked up here. */
	files: Set<string>;
}

export const getTestSubject = ({ test, files }: Params): string | undefined => {
	const stem = `${getDirectory({ path: test })}/${getTestSubjectName({ test })}`;

	return sourceExtensions.map((extension) => `${stem}${extension}`).find((candidate) => files.has(candidate));
};
