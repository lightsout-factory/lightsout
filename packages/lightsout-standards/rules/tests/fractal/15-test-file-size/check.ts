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
					guidance:
						'A test file this long is a module asking for promotion — give each internal unit a direct test beside it, export the unit from the module’s barrel, and leave the boundary file its orchestration.',
					measure: lineCount,
				}),
			];
};

export const check: StandardsCheckModule = {
	inputKinds: ['test-file'],
	run: ({ inputs, options }): RawStandardsFinding[] =>
		readTestFiles({ input: inputs['test-file'] }).flatMap(({ file, text }) => buildFileFindings({ file, text, limit: options.testFile })),
};
