import type ts from 'typescript';
import type { CloneSpan } from '#src/CloneSpan.ts';
import type { StandardsInputKind } from '#src/StandardsInputKind.ts';

export interface FileListInput {
	kind: typeof StandardsInputKind.FileList;
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	/** Declared dependency names per package dir ('.' for the repo root) — engine-read from each package.json. */
	dependencies: Map<string, string[]>;
	/** Repo-relative roots of the standards packs in the tree. Inside one, a `tests/` folder names a document set rather than a directory of tests — pass it to `isTestFile`. */
	standardsPacks: string[];
}

export interface FileTextInput {
	kind: typeof StandardsInputKind.FileText;
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	/**
	 * Text for every path in `files` ∪ `referenceFiles`, plus every tsconfig.json
	 * and package.json above one of them, when present.
	 *
	 * Every tsconfig and manifest, not just the root's, because path aliases are
	 * declared per package: a rule must read the nearest config above that file.
	 */
	contents: Map<string, string>;
	/** Repo-relative roots of the standards packs in the tree. Inside one, a `tests/` folder names a document set rather than a directory of tests — pass it to `isTestFile`. */
	standardsPacks: string[];
}

export interface SyntaxTreeInput {
	kind: typeof StandardsInputKind.SyntaxTree;
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	compiler: typeof ts;
	/** One parsed SourceFile per path in `source`. */
	trees: Map<string, ts.SourceFile>;
	/** What each package declares it depends on, keyed by package root (`.` for the repo). A framework carve-out is keyed on what a package DECLARES, so an AST rule needs this to honour one. */
	dependencies: Map<string, string[]>;
	/** Repo-relative roots of the standards packs in the tree. Inside one, a `tests/` folder names a document set rather than a directory of tests — pass it to `isTestFile`. */
	standardsPacks: string[];
}

export interface TypeCheckerInput {
	kind: typeof StandardsInputKind.TypeChecker;
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	compiler: typeof ts;
	/**
	 * One entry per file the engine could type in `files` ∪ `referenceFiles`.
	 * Wider than `source` on purpose, because a consumer may be a test or outside a
	 * `--path` scope; which files a rule may report on is what `source`, `tests`
	 * and `files` answer.
	 *
	 * The checker is per file because a repo has one program per tsconfig, and a
	 * type is meaningful only to the checker of the program holding the file. A
	 * file no tsconfig covers is absent.
	 */
	typedFiles: Map<string, { sourceFile: ts.SourceFile; checker: ts.TypeChecker }>;
	/** What each package declares it depends on, keyed by package root (`.` for the repo). A framework carve-out is keyed on what a package DECLARES, so a typed rule needs this to honour one. */
	dependencies: Map<string, string[]>;
	/** Repo-relative roots of the standards packs in the tree. Inside one, a `tests/` folder names a document set rather than a directory of tests — pass it to `isTestFile`. */
	standardsPacks: string[];
}

export interface TestFileInput {
	kind: typeof StandardsInputKind.TestFile;
	cwd: string;
	tests: string[];
	/** Text for every path in `tests`, from the run's shared content cache. */
	contents: Map<string, string>;
}

export interface ImportGraphInput {
	kind: typeof StandardsInputKind.ImportGraph;
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	/** Edges as `collectImportEdges` resolves them: repo-relative from/to pairs. */
	edges: Array<{ from: string; to: string }>;
	/** What each package declares it depends on, keyed by package root (`.` for the repo). A framework carve-out is keyed on what a package DECLARES, so a boundary rule needs this to honour one — a module folder a framework mandates is not the rule's to judge. */
	dependencies: Map<string, string[]>;
	/** Repo-relative roots of the standards packs in the tree. Inside one, a `tests/` folder names a document set rather than a directory of tests — pass it to `isTestFile`. */
	standardsPacks: string[];
}

export interface CloneSpansInput {
	kind: typeof StandardsInputKind.CloneSpans;
	cwd: string;
	source: string[];
	spans: CloneSpan[];
}

/**
 * A check never opens a file: the engine builds each shape once per run from one
 * shared content cache. The set is closed; a pack cannot ship its own reader.
 */
export type StandardsCheckInput = FileListInput | FileTextInput | SyntaxTreeInput | TypeCheckerInput | TestFileInput | ImportGraphInput | CloneSpansInput;
