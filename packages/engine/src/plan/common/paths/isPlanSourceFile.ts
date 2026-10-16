import { isSourceFile } from '#src/common/sourceFiles/isSourceFile.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import type { RepoFileGlobs } from '#src/common/types/RepoFileGlobs.ts';

interface Params {
	path: string;
	/** The repo's own globs: a plan counts the code files they name, never its tests. */
	fileGlobs: RepoFileGlobs;
}

/** The plan template states the same rule, so the drafter counts what the lint counts. */
export const isPlanSourceFile = ({ path, fileGlobs }: Params): boolean =>
	isSourceFile({ path, sourceFileGlobs: fileGlobs.source }) && !isTestFile({ path, testFileGlobs: fileGlobs.tests });
