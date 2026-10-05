import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readTestFiles } from '#common/checkInput/readTestFiles.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';

/** Measured against the `testFile` option, so a repo retunes the cap without touching the check. */
const buildFileFindings = ({ file, text, limit }: { file: string; text: string; limit: number }): RawStandardsFinding[] => {
	const lineCount = text.split('\n').length;

	return lineCount <= limit
		? []
		: [
				buildRawFinding({
					rule: 'test-file-size',
					files: [{ path: file }],
					detail: `${lineCount} lines (cap ~${limit})`,
					guidance: 'Split it by named scenario, one concern per file.',
					measure: lineCount,
				}),
			];
};

export const check: StandardsCheckModule = {
	inputKinds: ['test-file'],
	run: ({ inputs, options }): RawStandardsFinding[] =>
		readTestFiles({ input: inputs['test-file'] }).flatMap(({ file, text }) => buildFileFindings({ file, text, limit: options.testFile })),
};
