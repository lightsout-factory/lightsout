import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type ts from 'typescript';
import { isInertSourceFile } from '#src/common/sourceFiles/isInertSourceFile.ts';
import { isTestableSourceFile } from '#src/common/sourceFiles/isTestableSourceFile.ts';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';
import type { CoverageFile } from '#src/contracts/coverage/CoverageFile.ts';
import type { CoverageTotal } from '#src/contracts/coverage/CoverageTotal.ts';

interface Params {
	cwd: string;
	/** This round's measurement: every measured file, and each scope's own verdict. */
	measured: { files: CoverageFile[]; totals: CoverageTotal[] };
	/** Paths already routed to a human — never handed to another writer. */
	setAsidePaths: Set<string>;
	/** Repo-relative standards-pack roots, resolved once by the pipeline — a rule check under a pack's `tests/` document set is source, not a test. */
	standardsLibraries: string[];
	/** The consumer's TypeScript module, or undefined — nothing is classified inert without one. */
	compiler: typeof ts | undefined;
}

/**
 * A test file is excluded because a misconfigured coverage collection can put
 * one in the summary. Untestable source is excluded because it sits at the
 * bottom of a statements ordering and would fill the first batches with
 * guaranteed declines, enough in a row to read as a systemic stop. Without the
 * consumer's TypeScript, nothing is classified inert.
 */
export const selectCoverageCandidates = async ({ cwd, measured, setAsidePaths, standardsLibraries, compiler }: Params): Promise<CoverageFile[]> => {
	const failingScopes = new Set(measured.totals.filter((total) => !total.passed).map((total) => total.scope));
	const candidates: CoverageFile[] = [];

	for (const file of measured.files) {
		if (
			!failingScopes.has(file.scope) ||
			setAsidePaths.has(file.path) ||
			file.statementsPct >= 100 ||
			isTestFile({ path: file.path, standardsLibraries }) ||
			!isTestableSourceFile({ path: file.path })
		) {
			continue;
		}

		const content = compiler === undefined ? undefined : await readFile(join(cwd, file.path), 'utf8').catch(() => undefined);

		if (compiler !== undefined && content !== undefined && isInertSourceFile({ path: file.path, content, compiler })) {
			continue;
		}

		candidates.push(file);
	}

	return candidates;
};
