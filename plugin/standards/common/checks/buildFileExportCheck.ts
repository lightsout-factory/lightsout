import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '../checkInput/readFileTexts/readFileTexts.ts';
import { buildRawFinding } from '../findings/buildRawFinding.ts';
import { readFileExports } from '../parsing/readFileExports.ts';
import { isIndexFile } from '../paths/isIndexFile.ts';
import { isTestFile } from '../paths/isTestFile.ts';
import type { FileExport } from '../types/FileExport.ts';

interface Params {
	rule: string;
	/** What one file's exports violate, or undefined when the file is clean. */
	detail: ({ file, text, exports }: { file: string; text: string; exports: FileExport[] }) => string | undefined;
	guidance: string;
}

/**
 * Index files are exempt because they declare nothing of their own, and test files
 * because the test standards own them.
 *
 * One finding per file, since the work is "open this file and fix what it
 * says".
 */
export const buildFileExportCheck = ({ rule, detail, guidance }: Params): StandardsCheckModule => ({
	inputKinds: ['file-text'],
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, contents, standardsLibraries } = readFileTexts({ input: inputs['file-text'] });
		return files
			.filter((file) => !isTestFile({ path: file, standardsLibraries }) && !isIndexFile({ path: file }))
			.map((file) => {
				const text = contents.get(file) ?? '';
				const violation = detail({ file, text, exports: readFileExports({ text }) });

				return violation === undefined ? undefined : buildRawFinding({ rule, files: [{ path: file }], detail: violation, guidance });
			})
			.filter((finding): finding is RawStandardsFinding => finding !== undefined);
	},
});
