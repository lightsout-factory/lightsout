import type { RawStandardsFinding, StandardsCheckModule } from '@lightsout/standards-contracts';
import { readPathLists } from '../../../../common/checkInput/readPathLists.ts';
import { commonTypeFolders } from '../../../../common/constants/commonTypeFolders.ts';
import { buildRawFinding } from '../../../../common/findings/buildRawFinding.ts';
import { collectDirectories } from '../../../../common/paths/collectDirectories.ts';
import { getBaseName } from '../../../../common/paths/getBaseName.ts';
import { getDirectory } from '../../../../common/paths/getDirectory.ts';
import { isTestFile } from '../../../../common/paths/isTestFile.ts';

const isDomainFolder = ({ directory }: { directory: string }) =>
	getBaseName({ path: getDirectory({ path: directory }) }) === 'common' && !commonTypeFolders.has(getBaseName({ path: directory }));

export const check: StandardsCheckModule = {
	inputKind: 'file-list',
	// The always-built type-folder skeleton is never judged, and the test beside
	// a file does not make a second file.
	run: ({ input }): RawStandardsFinding[] => {
		const { files, standardsLibraries } = readPathLists({ input });
		const productionFiles = files.filter((file) => !isTestFile({ path: file, standardsLibraries }));

		return [...collectDirectories({ files })]
			.sort()
			.filter((directory) => isDomainFolder({ directory }) && productionFiles.filter((file) => getDirectory({ path: file }) === directory).length === 1)
			.map((directory) =>
				buildRawFinding({
					rule: 'single-file-domain-folder',
					files: [{ path: directory }],
					detail: `domain folder '${getBaseName({ path: directory })}' holds one file`,
					guidance:
						'Move the file back into `utils/`. A domain folder starts when a second function about the same subject appears. Heuristic — judge before acting.',
				}),
			);
	},
};
