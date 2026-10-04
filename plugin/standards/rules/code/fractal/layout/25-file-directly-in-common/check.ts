import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readFileTexts } from '#common/checkInput/readFileTexts.ts';
import { isBarrelFile } from '#common/paths/isBarrelFile.ts';
import { isTestFile } from '#common/paths/isTestFile.ts';
import { findEarlyFolders } from './findEarlyFolders.ts';
import { findMisfiledFiles } from './findMisfiledFiles.ts';

export const check: StandardsCheckModule = {
	inputKinds: ['file-text'],
	// File text rather than the file list, because which folder of a `common/` a
	// file goes in is decided by what it exports. An index file in a `common/`
	// is `index-files`'s to report, so it is left out here: one wrong file is
	// one finding.
	run: ({ inputs, options }): RawStandardsFinding[] => {
		const { files, contents, standardsLibraries } = readFileTexts({ input: inputs['file-text'] });
		const sourceFiles = files.filter((file) => !isTestFile({ path: file, standardsLibraries }) && !isBarrelFile({ path: file }));

		return [...findMisfiledFiles({ files: sourceFiles, contents }), ...findEarlyFolders({ files: sourceFiles, cap: options.cap ?? 0 })];
	},
};
