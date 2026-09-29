import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { readWorktreeRecord } from '#src/worktree/records/readWorktreeRecord.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
	/** The run's configured `generated` path prefixes. Build output under one of them is never a stray edit, whoever regenerated it. */
	generated: string[];
}

/**
 * The commit stages through `git add -A`, so in a checkout a person chose, anything
 * they edited while the run sat parked would ride into the pull request. The tree is
 * compared against the run's own files rather than refused outright, because a parked
 * run's partial work is what makes it dirty. A tree lightsout cut for this ticket skips
 * the check. Generated paths are dropped because this runs before `commitWorkOrderWork`
 * takes build output back out of the tree.
 */
export const describeUnownedEdits = async ({ cwd, manifest, generated }: Params): Promise<string | undefined> => {
	const record = manifest.branch === undefined ? undefined : await readWorktreeRecord({ cwd, branch: manifest.branch });

	if (record !== undefined) {
		return undefined;
	}

	const own = new Set([...manifest.changedFiles, ...manifest.baselineDirtyFiles]);
	const stray = ((await readGitChangedFiles({ cwd })) ?? []).filter((path) => !own.has(path) && !isGeneratedPath({ path, generated }));

	return stray.length === 0
		? undefined
		: `${cwd} holds changes this run did not make: ${stray.join(', ')} — commit or stash them before resuming, or they ride into this ticket's commit`;
};
