import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';

interface Params {
	path: string;
	/** The repo's `test-files` globs. */
	testFileGlobs: string[];
}

/**
 * A type-only module is NOT excluded, only `.d.ts`: a hand-authored `Foo.ts`
 * exporting one interface still has to be specified and written. The plan
 * template states the same rule, so the drafter counts what the lint counts.
 */
export const isPlanSourceFile = ({ path, testFileGlobs }: Params): boolean =>
	!isTestFile({ path, testFileGlobs }) && !/(^|\/)index\.[jt]sx?$/.test(path) && !/\.d\.ts$/.test(path);
