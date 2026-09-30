import type { StandardsCheckInput } from '@lightsout/standards-contracts';
import type { FileTexts } from '../types/FileTexts.ts';

interface Params {
	/** Whatever the engine built for this run — only a file-text input carries contents. */
	input: StandardsCheckInput;
}

/**
 * An input of any other kind yields an empty scope, for the same reason
 * `readPathLists` does: a rule that declared `file-text` is never handed
 * another kind.
 */
export const readFileTexts = ({ input }: Params): FileTexts =>
	input.kind === 'file-text'
		? { files: input.files, tests: input.tests, referenceFiles: input.referenceFiles, contents: input.contents, standardsLibraries: input.standardsLibraries }
		: { files: [], tests: [], referenceFiles: [], contents: new Map<string, string>(), standardsLibraries: [] };
