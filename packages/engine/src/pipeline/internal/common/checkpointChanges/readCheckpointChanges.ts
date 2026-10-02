import { GitChangeKind } from '#src/common/constants/GitChangeKind.ts';
import { readGitCommittedFile } from '#src/common/git/readGitCommittedFile.ts';
import { readGitWorkingChanges } from '#src/common/git/readGitWorkingChanges.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';

interface Params {
	run: PipelineRun;
}

// A path git reports removed that `HEAD` never held was created and deleted
// within the run, so it is no change at all.
const removedSinceHead = async ({ run, paths }: { run: PipelineRun; paths: string[] }) => {
	const tracked: string[] = [];

	for (const path of paths) {
		if ((await readGitCommittedFile({ cwd: run.cwd, path: `./${path}` })) !== undefined) {
			tracked.push(path);
		}
	}

	return tracked;
};

/**
 * A checkpoint's own changes, split by kind: files dirty before the run and
 * generated paths are not the agent's work, so they are left out.
 *
 * @returns `undefined` when git cannot report the working changes, so a caller can fail closed
 */
export const readCheckpointChanges = async ({ run }: Params): Promise<{ removed: string[]; added: string[]; modified: string[] } | undefined> => {
	const changes = await readGitWorkingChanges({ cwd: run.cwd });

	if (changes === undefined) {
		return undefined;
	}

	const baselineDirty = new Set(run.current().baselineDirtyFiles);
	const generated = run.config.generated ?? [];
	const inScope = changes.filter(({ path }) => !baselineDirty.has(path) && !isGeneratedPath({ path, generated }));
	const pathsOf = ({ kind }: { kind: GitChangeKind }) => inScope.filter((change) => change.kind === kind).map((change) => change.path);

	return {
		removed: await removedSinceHead({ run, paths: pathsOf({ kind: GitChangeKind.Removed }) }),
		added: pathsOf({ kind: GitChangeKind.Added }),
		modified: pathsOf({ kind: GitChangeKind.Modified }),
	};
};
