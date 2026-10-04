import { readGitCommittedFile } from '#src/pipeline/common/readGitCommittedFile.ts';

interface Params {
	cwd: string;
	testFile: string;
	/** The plan's moves whose destination is a test file. */
	movePaths: { from: string; to: string }[];
}

/**
 * A move destination does not exist at `HEAD`, so its source is read instead; otherwise a
 * test written for older behaviour could become a new criterion's verifier by moving its file.
 */
export const readCommittedTestSource = async ({ cwd, testFile, movePaths }: Params): Promise<string | undefined> => {
	const move = movePaths.find((entry) => entry.to === testFile);

	return readGitCommittedFile({ cwd, path: move?.from ?? testFile });
};
