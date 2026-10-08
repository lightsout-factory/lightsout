import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '#common/checkInput/readFileTexts/readFileTexts.ts';
import { isIndexFile } from '#common/paths/isIndexFile.ts';
import { findMisfiledFiles } from './findMisfiledFiles.ts';

export const check: StandardsCheckModule = {
	inputKinds: ['file-text'],
	// File text rather than the file list, because which folder of a `common/` a
	// file goes in is decided by what it exports. An index file in a `common/`
	// is `index-files`'s to report, so it is left out here: one wrong file is
	// one finding.
	run: ({ inputs }): RawStandardsFinding[] => {
		const { files, contents, tests } = readFileTexts({ input: inputs['file-text'] });
		const testFiles = new Set(tests);
		const sourceFiles = files.filter((file) => !testFiles.has(file) && !isIndexFile({ path: file }));

		return findMisfiledFiles({ files: sourceFiles, contents });
	},
};
