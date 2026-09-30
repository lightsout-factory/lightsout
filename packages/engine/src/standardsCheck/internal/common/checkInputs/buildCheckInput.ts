import { type StandardsCheckInput, StandardsInputKind } from '@lightsout/standards-contracts';
import type ts from 'typescript';
import { buildCloneSpansInput } from '#src/standardsCheck/internal/common/checkInputs/buildCloneSpansInput.ts';
import { buildFileListInput } from '#src/standardsCheck/internal/common/checkInputs/buildFileListInput.ts';
import { buildFileTextInput } from '#src/standardsCheck/internal/common/checkInputs/buildFileTextInput.ts';
import { buildImportGraphInput } from '#src/standardsCheck/internal/common/checkInputs/buildImportGraphInput.ts';
import { buildSyntaxTreeInput } from '#src/standardsCheck/internal/common/checkInputs/buildSyntaxTreeInput.ts';
import { buildTestFileInput } from '#src/standardsCheck/internal/common/checkInputs/buildTestFileInput.ts';
import { buildTypeCheckerInput } from '#src/standardsCheck/internal/common/checkInputs/buildTypeCheckerInput.ts';

interface Params {
	/** Which shape to build — the kind a rule's check declared. */
	kind: StandardsInputKind;
	cwd: string;
	source: string[];
	tests: string[];
	files: string[];
	referenceFiles: string[];
	/** Repo-relative standards pack roots, from the walk that listed the files. */
	standardsLibraries: string[];
	/** Monorepo package parent dir (config `packages-dir`, default 'packages') — every kind that carries `dependencies` reads it. */
	packagesDir: string;
	/** The asking rule's resolved options — only the clone-spans detector reads them. */
	options: Record<string, number>;
	/** The run's shared content cache — every text-carrying kind draws from it. */
	cache: Map<string, string>;
	/** The consumer's TypeScript, when it resolved. */
	compiler?: typeof ts;
}

/**
 * Both the run and the fixture validation come through here, so a rule is
 * handed exactly the same shape whether it is checking a repo or its own fixtures.
 *
 * @throws {Error} When the kind needs TypeScript and none was resolved — callers skip such rules with a note instead.
 */
export const buildCheckInput = async ({
	kind,
	cwd,
	source,
	tests,
	files,
	referenceFiles,
	standardsLibraries,
	packagesDir,
	options,
	cache,
	compiler,
}: Params): Promise<StandardsCheckInput> => {
	switch (kind) {
		case StandardsInputKind.FileList:
			return buildFileListInput({ cwd, source, tests, files, referenceFiles, standardsLibraries, packagesDir });

		case StandardsInputKind.FileText:
			return buildFileTextInput({ cwd, source, tests, files, referenceFiles, standardsLibraries, cache });

		case StandardsInputKind.TestFile:
			return buildTestFileInput({ cwd, tests, cache });

		case StandardsInputKind.CloneSpans:
			return buildCloneSpansInput({ cwd, source, options, cache, compiler });

		case StandardsInputKind.SyntaxTree:
		case StandardsInputKind.TypeChecker:
		case StandardsInputKind.ImportGraph: {
			if (compiler === undefined) {
				throw new Error(`the ${kind} input needs the consumer's typescript, which did not resolve`);
			}

			if (kind === StandardsInputKind.ImportGraph) {
				return buildImportGraphInput({ cwd, source, tests, files, referenceFiles, standardsLibraries, compiler, packagesDir });
			}

			if (kind === StandardsInputKind.TypeChecker) {
				return buildTypeCheckerInput({ cwd, source, tests, files, referenceFiles, standardsLibraries, compiler, packagesDir });
			}

			return buildSyntaxTreeInput({ cwd, source, tests, files, referenceFiles, standardsLibraries, compiler, cache, packagesDir });
		}
	}
};
