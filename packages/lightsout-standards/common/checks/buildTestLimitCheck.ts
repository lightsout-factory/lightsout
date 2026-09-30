import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readTestFiles } from '../checkInput/readTestFiles.ts';
import { buildRawFinding } from '../findings/buildRawFinding.ts';

interface Params {
	rule: string;
	/** Names the rule option that holds the limit it measures against. */
	option: string;
	/** What one test file broke and the sites to report it against, or undefined when the file is within the limit. */
	report: ({
		file,
		text,
		limit,
	}: {
		file: string;
		text: string;
		limit: number;
	}) => { files: RawStandardsFinding['files']; detail: string; measure?: number } | undefined;
	guidance: string;
}

export const buildTestLimitCheck = ({ rule, option, report, guidance }: Params): StandardsCheckModule => ({
	inputKind: 'test-file',
	run: ({ input, options }): RawStandardsFinding[] =>
		readTestFiles({ input }).flatMap(({ file, text }) => {
			const violation = report({ file, text, limit: options[option] });

			return violation === undefined ? [] : [buildRawFinding({ rule, files: violation.files, detail: violation.detail, guidance, measure: violation.measure })];
		}),
});
