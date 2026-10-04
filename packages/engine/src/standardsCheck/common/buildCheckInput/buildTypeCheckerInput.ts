import { dirname, join, resolve } from 'node:path';
import { StandardsInputKind, type TypeCheckerInput } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { readPackageDependencies } from '#src/standardsCheck/common/readPackageDependencies.ts';

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
	/** Monorepo package parent dir (config `packages-dir`, default 'packages'). */
	packagesDir: string;
}

/**
 * Nearest rather than the repo's, because a workspace declares its compiler
 * options per package — path aliases above all. A file typed against the wrong
 * config resolves its imports to nothing, and a checker that resolved nothing
 * reports `any` everywhere, which reads to a rule as "no finding here".
 */
const findNearestConfig = ({ cwd, path, compiler }: { cwd: string; path: string; compiler: typeof ts }): string | undefined => {
	let folder = dirname(resolve(cwd, path));

	while (folder.startsWith(cwd)) {
		const candidate = join(folder, 'tsconfig.json');

		if (compiler.sys.fileExists(candidate)) {
			return candidate;
		}

		folder = dirname(folder);
	}

	return undefined;
};

/**
 * Built from each config's own file list rather than the paths in scope: a
 * program missing a file its members import types from cannot resolve them, and
 * the check reads the gap as an absence of findings.
 */
const buildPrograms = ({ configPaths, compiler }: { configPaths: Set<string>; compiler: typeof ts }) => {
	const programs = new Map<string, ts.Program>();

	for (const configPath of configPaths) {
		const read = compiler.readConfigFile(configPath, compiler.sys.readFile);

		if (read.error !== undefined) {
			continue;
		}

		const parsed = compiler.parseJsonConfigFileContent(read.config, compiler.sys, dirname(configPath));

		programs.set(configPath, compiler.createProgram({ rootNames: parsed.fileNames, options: parsed.options }));
	}

	return programs;
};

/**
 * Types every reference file too, because a rule that asks "does anything
 * consume this?" needs the consumers typed, and a consumer may be a test or a
 * file outside a `--path` scope. Which files a rule may report on is answered
 * by `source`, `tests` and `files`.
 *
 * A file no program holds is left out rather than guessed at.
 */
export const buildTypeCheckerInput = async ({
	cwd,
	source,
	tests,
	files,
	referenceFiles,
	standardsLibraries,
	compiler,
	packagesDir,
}: Params): Promise<TypeCheckerInput> => {
	const configOf = new Map<string, string>();

	for (const path of new Set([...files, ...referenceFiles])) {
		const configPath = findNearestConfig({ cwd, path, compiler });

		if (configPath !== undefined) {
			configOf.set(path, configPath);
		}
	}

	const programs = buildPrograms({ configPaths: new Set(configOf.values()), compiler });
	const typedFiles = new Map<string, { sourceFile: ts.SourceFile; checker: ts.TypeChecker }>();

	for (const [path, configPath] of configOf) {
		const program = programs.get(configPath);
		const sourceFile = program?.getSourceFile(resolve(cwd, path));

		if (program !== undefined && sourceFile !== undefined) {
			typedFiles.set(path, { sourceFile, checker: program.getTypeChecker() });
		}
	}

	return {
		kind: StandardsInputKind.TypeChecker,
		cwd,
		source,
		tests,
		files,
		referenceFiles,
		standardsLibraries,
		compiler,
		typedFiles,
		dependencies: await readPackageDependencies({ cwd, packagesDir }),
	};
};
