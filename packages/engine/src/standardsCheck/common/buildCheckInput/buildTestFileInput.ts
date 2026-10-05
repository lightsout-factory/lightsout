import { StandardsInputKind, type TestFileInput } from '@lightsout/standards-contracts';
import { readIntoCache } from '#src/standardsCheck/common/readIntoCache.ts';

interface Params {
	cwd: string;
	tests: string[];
	/** The run's shared cache — a test file the text input already read is not read again. */
	cache: Map<string, string>;
}

/**
 * `contents` holds the test paths alone, not the whole shared cache: a
 * test-shape rule that could reach source files through its input would be
 * checking something its declaration does not claim.
 */
export const buildTestFileInput = async ({ cwd, tests, cache }: Params): Promise<TestFileInput> => {
	const contents = await readIntoCache({ cwd, paths: tests, cache });

	return { kind: StandardsInputKind.TestFile, cwd, tests, contents };
};
