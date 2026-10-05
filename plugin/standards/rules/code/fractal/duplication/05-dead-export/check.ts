import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '#common/checkInput/readFileTexts/readFileTexts.ts';
import { buildRawFinding } from '#common/findings/buildRawFinding.ts';
import { getUnconsumedExports } from '#common/modules/getUnconsumedExports/getUnconsumedExports.ts';

export const check: StandardsCheckModule = {
	inputKinds: ['file-text'],
	/**
	 * A folder index file's mention does not count, since nothing imports through
	 * one. Any other mention does, even in a comment or a string, so calling a
	 * live export dead is rare. One finding per file, naming every dead export
	 * it declares.
	 */
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, contents, standardsLibraries } = readFileTexts({ input: inputs['file-text'] });
		const byFile = new Map<string, string[]>();

		for (const { file, name } of getUnconsumedExports({ files, contents, standardsLibraries })) {
			byFile.set(file, [...(byFile.get(file) ?? []), name]);
		}

		return [...byFile].map(([file, names]) =>
			buildRawFinding({
				rule: 'dead-export',
				files: [{ path: file }],
				detail: `${names.map((name) => `'${name}'`).join(', ')} ${names.length > 1 ? 'are' : 'is'} referenced nowhere else`,
				guidance: 'Nothing references it. Delete it.',
			}),
		);
	},
};
