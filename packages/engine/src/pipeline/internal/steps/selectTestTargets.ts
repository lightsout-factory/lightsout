import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type ts from 'typescript';
import { isInertSourceFile } from '#src/common/sourceFiles/isInertSourceFile.ts';
import { isToolingConfigFile } from '#src/common/sourceFiles/isToolingConfigFile.ts';
import { selectCollectedFiles } from '#src/coverage/selectCollectedFiles/selectCollectedFiles.ts';
import { selectUnloadableFiles } from '#src/coverage/selectUnloadableFiles/selectUnloadableFiles.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';

interface Params {
	run: PipelineRun;
	candidates: string[];
	/** The consumer's TypeScript module, or undefined — nothing is classified inert without one. */
	compiler: typeof ts | undefined;
	/** The workspace's packages folder, so a package root is recognised as a root. */
	packagesDir: string;
}

/**
 * - `deleted`: git reports a removal as changed, and routing it to a writer
 *   wastes a spawn that escalates the run; whether a file exists is a fact the
 *   engine owns.
 * - `inert`: barrels and type-only files hold no executable code, so a writer
 *   is a guaranteed no-op. Without the consumer's TypeScript, nothing is inert.
 * - `uncoverable`: real code no unit test can run — a tool's own settings file,
 *   a file with a module-scope `await` under a CommonJS Jest, or a file the
 *   repo's coverage configuration does not collect. Kept apart from `inert` so
 *   the run never calls real code type-only.
 * - `targets`: everything with runtime code to cover.
 *
 * `coverageExcluded` is a labelled subset of `uncoverable`, not a fifth bucket.
 */
export const selectTestTargets = async ({
	run,
	candidates,
	compiler,
	packagesDir,
}: Params): Promise<{ targets: string[]; inert: string[]; uncoverable: string[]; deleted: string[]; coverageExcluded: string[] }> => {
	const { excluded } = await selectCollectedFiles({ cwd: run.cwd, config: run.config, files: candidates });
	const { unloadable } = await selectUnloadableFiles({ cwd: run.cwd, config: run.config, files: candidates, compiler });
	const uncollected = new Set(excluded);
	const unloadableFiles = new Set(unloadable);
	const targets: string[] = [];
	const inert: string[] = [];
	const uncoverable: string[] = [];
	const deleted: string[] = [];
	const coverageExcluded: string[] = [];

	for (const file of candidates) {
		const content = await readFile(join(run.cwd, file), 'utf8').catch(() => undefined);

		if (content === undefined) {
			// Unreadable: a plan-deleted file has no source to cover — drop it.
			// A file still on disk (transiently unreadable) keeps its writer.
			const exists = await stat(join(run.cwd, file)).then(
				() => true,
				() => false,
			);

			(exists ? targets : deleted).push(file);
			continue;
		}

		const excludedFromCoverage = uncollected.has(file);

		if (isToolingConfigFile({ path: file, packagesDir }) || excludedFromCoverage || unloadableFiles.has(file)) {
			uncoverable.push(file);

			if (excludedFromCoverage) {
				coverageExcluded.push(file);
			}
		} else if (compiler && isInertSourceFile({ path: file, content, compiler })) {
			inert.push(file);
		} else {
			targets.push(file);
		}
	}

	return { targets, inert, uncoverable, deleted, coverageExcluded };
};
