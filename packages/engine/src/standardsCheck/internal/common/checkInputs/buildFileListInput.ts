import { type FileListInput, StandardsInputKind } from '@lightsout/standards-contracts';
import { readPackageDependencies } from '#src/common/workspace/readPackageDependencies.ts';

interface Params {
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	/** Repo-relative standards pack roots, from the walk that listed the files. */
	standardsLibraries: string[];
	/** Monorepo package parent dir (config `packages-dir`, default 'packages'). */
	packagesDir: string;
}

/**
 * Dependencies are read the same way channel detection reads them, so a rule
 * asking "does this repo use React?" gets the same answer either route.
 */
export const buildFileListInput = async ({ cwd, source, tests, files, referenceFiles, standardsLibraries, packagesDir }: Params): Promise<FileListInput> => {
	const dependencies = await readPackageDependencies({ cwd, packagesDir });

	return { kind: StandardsInputKind.FileList, cwd, source, tests, files, referenceFiles, dependencies, standardsLibraries };
};
