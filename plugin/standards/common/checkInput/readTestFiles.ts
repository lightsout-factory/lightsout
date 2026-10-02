import type { TestFileInput } from '@lightsout/standards-contracts';

interface Params {
	/** The test-file input the engine built for this run, when the rule declared that kind. */
	input: TestFileInput | undefined;
}

/** A missing input yields nothing: a rule that declared `test-file` is always handed it. */
export const readTestFiles = ({ input }: Params): Array<{ file: string; text: string }> =>
	input === undefined ? [] : [...input.contents].map(([file, text]) => ({ file, text }));
