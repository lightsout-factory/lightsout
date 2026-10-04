import { type ImportGraphInput, StandardsInputKind } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { collectImportEdges } from '#src/common/moduleGraph/collectImportEdges/collectImportEdges.ts';
import { readPackageDependencies } from '#src/standardsCheck/common/readPackageDependencies.ts';

interface Params {
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	/** Repo-relative standards pack roots, from the walk that listed the files. */
	standardsLibraries: string[];
	compiler: typeof ts;
	/** Monorepo package parent dir (config `packages-dir`, default 'packages'). */
	packagesDir: string;
}

/**
 * Built across the whole repo rather than the scoped file list: a boundary
 * rule asks whether anything outside a module reaches into it, which a graph
 * built from a `--path` scope would answer wrong.
 */
export const buildImportGraphInput = async ({
	cwd,
	source,
	tests,
	files,
	referenceFiles,
	standardsLibraries,
	compiler,
	packagesDir,
}: Params): Promise<ImportGraphInput> => {
	const edges = await collectImportEdges({ cwd, files: referenceFiles, compiler });
	const dependencies = await readPackageDependencies({ cwd, packagesDir });

	return { kind: StandardsInputKind.ImportGraph, cwd, source, tests, files, referenceFiles, standardsLibraries, edges, dependencies };
};
