import { StandardsInputKind, type SyntaxTreeInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { readPackageDependencies } from '#src/standardsCheck/internal/common/checkInputs/common/readPackageDependencies.ts';
import { readIntoCache } from '#src/standardsCheck/internal/common/checkInputs/readIntoCache.ts';

interface Params {
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	/** Repo-relative standards pack roots, from the walk that listed the files. */
	standardsLibraries: string[];
	/** The consumer's TypeScript — the engine never bundles a compiler of its own. */
	compiler: typeof ts;
	cache: Map<string, string>;
	/** Monorepo package parent dir (config `packages-dir`, default 'packages'). */
	packagesDir: string;
}

/** Parents are set on the nodes: a rule that asks what encloses a node cannot walk back up without them. */
export const buildSyntaxTreeInput = async ({
	cwd,
	source,
	tests,
	files,
	referenceFiles,
	standardsLibraries,
	compiler,
	cache,
	packagesDir,
}: Params): Promise<SyntaxTreeInput> => {
	const texts = await readIntoCache({ cwd, paths: source, cache });
	const dependencies = await readPackageDependencies({ cwd, packagesDir });
	const trees = new Map<string, ts.SourceFile>();

	for (const [path, text] of texts) {
		trees.set(path, compiler.createSourceFile(path, text, compiler.ScriptTarget.Latest, true));
	}

	return { kind: StandardsInputKind.SyntaxTree, cwd, source, tests, files, referenceFiles, standardsLibraries, compiler, trees, dependencies };
};
