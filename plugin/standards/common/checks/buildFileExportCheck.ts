import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '../checkInput/readFileTexts.ts';
import { buildRawFinding } from '../findings/buildRawFinding.ts';
import { readFileExports } from '../parsing/readFileExports.ts';
import { isBarrelFile } from '../paths/isBarrelFile.ts';
import { isTestFile } from '../paths/isTestFile.ts';
import type { FileExport } from '../types/FileExport.ts';

interface Params {
	rule: string;
	/** What one file's exports violate, or undefined when the file is clean. */
	detail: ({ file, exports }: { file: string; exports: FileExport[] }) => string | undefined;
	guidance: string;
	/**
	 * The files this rule does not judge, decided once from the run's whole
	 * scope rather than per file — a framework carve-out needs every manifest in
	 * `contents` to answer, and asking per file would re-read them all each time.
	 */
	getExempt?: ({ files, contents }: { files: string[]; contents: Map<string, string> }) => Set<string>;
}

/**
 * Barrels are exempt because they declare nothing of their own, and test files
 * because the test standards own them. `getExempt` is asked once for the whole
 * run, since a framework carve-out needs every manifest to answer.
 *
 * One finding per file, since the work is "open this file and fix what it
 * says".
 */
export const buildFileExportCheck = ({ rule, detail, guidance, getExempt }: Params): StandardsCheckModule => ({
	inputKind: 'file-text',
	run: ({ input }): RawStandardsFinding[] => {
		const { files, contents, standardsLibraries } = readFileTexts({ input });
		const exempt = getExempt?.({ files, contents }) ?? new Set<string>();

		return files
			.filter((file) => !isTestFile({ path: file, standardsLibraries }) && !isBarrelFile({ path: file }) && !exempt.has(file))
			.map((file) => {
				const violation = detail({ file, exports: readFileExports({ text: contents.get(file) ?? '' }) });

				return violation === undefined ? undefined : buildRawFinding({ rule, files: [{ path: file }], detail: violation, guidance });
			})
			.filter((finding): finding is RawStandardsFinding => finding !== undefined);
	},
});
