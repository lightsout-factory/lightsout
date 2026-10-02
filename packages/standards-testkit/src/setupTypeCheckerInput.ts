import { dirname, resolve } from 'node:path';
import type { TypeCheckerInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';
import ts from 'typescript';

interface Params extends Partial<Omit<TypeCheckerInput, 'kind' | 'typedFiles' | 'compiler' | 'dependencies'>> {
	sources?: Array<[string, string]>;
	dependencies?: Array<[string, string[]]>;
}

const root = '/repo';

/** `noLib`: loading the standard library into every rule's unit test would cost more than the tests themselves. */
const options: ts.CompilerOptions = { target: ts.ScriptTarget.Latest, strict: true, noEmit: true, noLib: true };

/**
 * Imports are resolved by path rather than by TypeScript's resolver, which
 * reaches the real filesystem: an import it cannot resolve types the importer's
 * values as `any` silently, and a rule reading them would report nothing.
 */
const setupHost = ({ trees }: { trees: Map<string, ts.SourceFile> }): ts.CompilerHost => {
	const host = ts.createCompilerHost(options, true);

	host.getSourceFile = (name) => trees.get(name);
	host.resolveModuleNameLiterals = (literals, containingFile) =>
		literals.map((literal) => {
			const target = resolve(dirname(containingFile), literal.text);
			// A specifier may be written with the extension, without it, or as the
			// `.js` a bundler-free build emits — all three name the same file here.
			const resolvedFileName = [target, `${target}.ts`, target.replace(/\.js$/, '.ts')].find((candidate) => trees.has(candidate));

			return resolvedFileName === undefined ? { resolvedModule: undefined } : { resolvedModule: { resolvedFileName, extension: ts.Extension.Ts } };
		});

	return host;
};

/** @param sources - each file and its text, as pairs; paths are repo-relative and rooted under `/repo` */
export const setupTypeCheckerInput = ({ sources = [], dependencies = [], ...overrides }: Params = {}): TypeCheckerInput => {
	// Parsed once so the program's tree and the check's tree are the same
	// object: a checker only answers about nodes from its own program.
	const parsed = sources.map(([path, text]) => ({ path, sourceFile: ts.createSourceFile(resolve(root, path), text, ts.ScriptTarget.Latest, true) }));
	const trees = new Map(parsed.map(({ sourceFile }) => [sourceFile.fileName, sourceFile]));
	const program = ts.createProgram({ rootNames: [...trees.keys()], options, host: setupHost({ trees }) });
	const checker = program.getTypeChecker();

	return {
		kind: StandardsInputKind.TypeChecker,
		cwd: root,
		source: parsed.map(({ path }) => path),
		tests: [],
		files: parsed.map(({ path }) => path),
		referenceFiles: [],
		standardsLibraries: [],
		compiler: ts,
		typedFiles: new Map(parsed.map(({ path, sourceFile }) => [path, { sourceFile, checker }])),
		dependencies: new Map(dependencies),
		...overrides,
	};
};
