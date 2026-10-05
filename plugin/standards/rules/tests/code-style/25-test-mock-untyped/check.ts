import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readTestFiles } from '#common/checkInput/readTestFiles.ts';
import { buildLineSites } from '#common/findings/buildLineSites.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { findUntypedSpyLines } from './findUntypedSpyLines.ts';
import { findUntypedWrappers } from './findUntypedWrappers.ts';

/** One finding per file, naming the untyped spies and the wrappers that lose arguments apart. */
const mockTypingFindings = ({ file, text }: { file: string; text: string }) => {
	const lines = findUntypedSpyLines({ text });
	const wrappers = findUntypedWrappers({ text });
	const details = [
		...(lines.length === 0 ? [] : [`jest.fn() with no generic at line(s) ${lines.join(', ')}`]),
		...(wrappers.length === 0 ? [] : [wrappers.map(({ block, reasons }) => `${reasons.join('; ')} (line ${block.startLine})`).join(', ')]),
	];

	return details.length === 0
		? []
		: [
				buildRawFinding({
					rule: 'test-mock-untyped',
					files: buildLineSites({ file, spans: [...lines.map((line) => ({ startLine: line, endLine: line })), ...wrappers.map(({ block }) => block)] }),
					detail: details.join('; '),
					guidance:
						'Type every `jest.fn()` and every `jest.mock()` wrapper to the real signature: read the source first, include the Promise for an async function, and forward every argument.',
				}),
			];
};

export const check: StandardsCheckModule = {
	inputKinds: ['test-file'],
	run: ({ inputs }): RawStandardsFinding[] => readTestFiles({ input: inputs['test-file'] }).flatMap(mockTypingFindings),
};
