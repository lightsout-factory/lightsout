import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultPackagesDir } from '#src/common/constants/defaultPackagesDir.ts';
import { excludedSourcePaths } from '#src/common/sourceFiles/excludedSourcePaths.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import { resolveConsumerTypescript } from '#src/common/workspace/resolveConsumerTypescript.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { ExportCensus } from '#src/plan/common/types/ExportCensus.ts';
import { getNameKey } from '#src/plan/evidence/common/getNameKey.ts';
import { readDeclaredExports } from '#src/plan/evidence/readDeclaredExports.ts';

interface Params {
	cwd: string;
	config?: LightsoutConfig;
	/** A plan's own created and emptied paths. */
	exclude?: string[];
	/** cwd-relative folders, no trailing `/`, whose every file is left out — a folder the plan moves away. */
	excludeFolders?: string[];
}

/**
 * Every name the repo's source files declare and export, read from their
 * syntax. Test files are left out because a test states what the code should
 * do, so it is never prior art. A file that only re-exports declares nothing,
 * so it adds nothing. Without the consumer's TypeScript there is nothing to
 * read the code with, and the census is empty.
 */
export const buildExportCensus = async ({ cwd, config, exclude = [], excludeFolders = [] }: Params): Promise<ExportCensus> => {
	const excluded = new Set(exclude);
	const isExcluded = (file: string) => excluded.has(file) || excludeFolders.some((folder) => file === folder || file.startsWith(`${folder}/`));
	const compiler = resolveConsumerTypescript({ cwd, packagesDir: config?.['packages-dir'] ?? defaultPackagesDir });
	const buckets: ExportCensus = new Map();

	if (compiler === undefined) {
		return buckets;
	}

	const { files } = await listSourceFiles({ cwd, sourceFileGlobs: config?.['source-files'] ?? [], exclude: excludedSourcePaths({ config }) });
	const testFileGlobs = config?.['test-files'] ?? [];

	for (const file of files) {
		if (isTestFile({ path: file, testFileGlobs }) || isExcluded(file)) {
			continue;
		}

		const content = await readFile(join(cwd, file), 'utf8').catch(() => undefined);

		for (const name of content === undefined ? [] : readDeclaredExports({ path: file, content, compiler })) {
			const key = getNameKey({ name });

			buckets.set(key, [...(buckets.get(key) ?? []), { name, path: file }]);
		}
	}

	return buckets;
};
