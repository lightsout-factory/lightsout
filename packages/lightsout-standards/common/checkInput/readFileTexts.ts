import type { FileTextInput } from '@lightsout/standards-contracts';
import type { FileTexts } from '../types/FileTexts.ts';

interface Params {
	/** The file-text input the engine built for this run, when the rule declared that kind. */
	input: FileTextInput | undefined;
}

/** A missing input yields an empty scope, for the same reason `readPathLists` does: a rule that declared `file-text` is always handed it. */
export const readFileTexts = ({ input }: Params): FileTexts =>
	input === undefined
		? { files: [], tests: [], referenceFiles: [], contents: new Map<string, string>(), standardsLibraries: [] }
		: { files: input.files, tests: input.tests, referenceFiles: input.referenceFiles, contents: input.contents, standardsLibraries: input.standardsLibraries };
