import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readGitCommittedFile } from '#src/common/git/readGitCommittedFile.ts';
import type { CheckpointComparison } from '#src/pipeline/internal/common/types/CheckpointComparison.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';

interface Params {
	run: PipelineRun;
	comparison: CheckpointComparison;
}

/**
 * Reads a compared file at the phase's starting commit and as it is now, an
 * absent side reading as empty.
 *
 * @returns both texts, and the label a refusal line names the file by, which names both paths of a moved file
 */
export const readComparisonSides = async ({ run, comparison }: Params): Promise<{ start: string; current: string; label: string }> => {
	const { startPath, currentPath } = comparison;
	// `git show HEAD:<path>` resolves from the repository root; the `./` prefix
	// makes git resolve it against the working directory, so a nested consumer
	// does not read every file as untracked.
	const start = (await readGitCommittedFile({ cwd: run.cwd, path: `./${startPath}` })) ?? '';
	const current = (await readFile(join(run.cwd, currentPath), 'utf8').catch(() => undefined)) ?? '';
	const label = startPath === currentPath ? currentPath : `${currentPath} (moved from ${startPath})`;

	return { start, current, label };
};
