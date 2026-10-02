import { findSharedCode } from '#src/common/sharedCode/findSharedCode.ts';
import { excludedSourcePaths } from '#src/common/sourceFiles/excludedSourcePaths.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';
import type { SharedCodeFolder } from '#src/common/types/SharedCodeFolder.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

interface Params {
	cwd: string;
	config: Pick<LightsoutConfig, 'generated' | 'vendored'>;
	/** The files the agent is about to work on, repo-relative. Empty means there is nowhere to look from, and nothing is read. */
	workFiles: string[];
}

/**
 * Read from the tree at the moment an agent is spawned, never cached across a
 * run: the step before may have added shared code, and a listing that misses
 * it invites the very duplicate the listing exists to prevent. Tests,
 * generated output and vendored code are not shared code and are left out.
 */
export const listSharedCode = async ({ cwd, config, workFiles }: Params): Promise<SharedCodeFolder[]> => {
	const { files, standardsLibraries } =
		workFiles.length === 0 ? { files: [], standardsLibraries: [] } : await listSourceFiles({ cwd, exclude: excludedSourcePaths({ config }) });

	return findSharedCode({ sourceFiles: files.filter((path) => !isTestFile({ path, standardsLibraries })), workFiles });
};
