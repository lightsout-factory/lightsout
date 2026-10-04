import { runGit } from '#src/ship/common/runGit.ts';

interface Params {
	cwd: string;
}

/** Absence is the ordinary answer: a branch whose default branch had not moved never started a merge. */
export const hasOpenMerge = async ({ cwd }: Params): Promise<boolean> =>
	(await runGit({ command: 'git rev-parse -q --verify MERGE_HEAD', cwd }))?.exitCode === 0;
