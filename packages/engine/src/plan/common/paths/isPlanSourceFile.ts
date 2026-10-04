import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';

interface Params {
	path: string;
}

/**
 * A type-only module is NOT excluded, only `.d.ts`: a hand-authored `Foo.ts`
 * exporting one interface still has to be specified and written. The plan
 * template states the same rule, so the drafter counts what the lint counts.
 */
export const isPlanSourceFile = ({ path }: Params): boolean => !isTestFile({ path }) && !/(^|\/)index\.[jt]sx?$/.test(path) && !/\.d\.ts$/.test(path);
