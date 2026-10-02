import { excludedSourcePaths } from '#src/common/sourceFiles/excludedSourcePaths.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { getExportName } from '#src/plan/common/utils/getExportName.ts';
import type { ExportCensus } from '#src/plan/evidence/common/types/ExportCensus.ts';
import { getNameKey } from '#src/plan/internal/common/naming/getNameKey.ts';

interface Params {
	cwd: string;
	config?: LightsoutConfig;
	/** A plan's own created and emptied paths. */
	exclude?: string[];
	/** cwd-relative folders, no trailing `/`, whose every file is left out — a folder the plan moves away. */
	excludeFolders?: string[];
}

/**
 * One-export-per-file makes a source file's basename its symbol. Test files and
 * barrels are left out because neither can be prior art: a test states what the
 * code should do, and a barrel re-exports a name the census already holds.
 */
export const buildExportCensus = async ({ cwd, config, exclude = [], excludeFolders = [] }: Params): Promise<ExportCensus> => {
	const excluded = new Set(exclude);
	const isExcluded = (file: string) => excluded.has(file) || excludeFolders.some((folder) => file === folder || file.startsWith(`${folder}/`));
	const { files, standardsLibraries } = await listSourceFiles({ cwd, exclude: excludedSourcePaths({ config }) });
	const buckets: ExportCensus = new Map();

	for (const file of files) {
		const name = getExportName({ path: file });

		if (isTestFile({ path: file, standardsLibraries }) || name === 'index' || isExcluded(file)) {
			continue;
		}

		const key = getNameKey({ name });

		buckets.set(key, [...(buckets.get(key) ?? []), { name, path: file }]);
	}

	return buckets;
};
