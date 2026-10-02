import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discardGeneratedChanges } from '#src/commit/discardGeneratedChanges.ts';
import type { CommitFailure } from '#src/commit/internal/common/types/CommitFailure.ts';
import { toLiteralPathspecs } from '#src/commit/internal/common/utils/toLiteralPathspecs.ts';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runOrDescribeFailure } from '#src/common/processes/runOrDescribeFailure.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';

interface Params {
	cwd: string;
	/** Writes the commit's message from what is staged. Called once, after the generated paths are set aside and the source changes staged, and only when there is something to commit. */
	composeMessage: ({ cwd }: { cwd: string }) => Promise<string>;
	/** Run directory the message file is written into — inside `.lightsout`, which is gitignored. */
	runDir: string;
	/**
	 * The config's `generated` path prefixes. A change under one of these is
	 * never committed — it is discarded, or left uncommitted on disk when
	 * `keepGenerated` is set: the pre-ship step at merge time is the one place
	 * build output enters history, and it runs after the rebase.
	 */
	generated?: string[];
	/**
	 * Leave generated changes uncommitted on disk instead of discarding them, still keeping them out of the commit.
	 * A phase of a sequence sets it so the next phase starts from current build output. Default false.
	 */
	keepGenerated?: boolean;
	/** Live progress sink — one line when generated changes were discarded or kept. */
	onProgress?: (message: string) => void;
}

/**
 * Takes the changed generated paths out of the commit's way. Keeping unstages
 * them before anything is staged, because an agent may have staged build
 * output itself, and staging must never carry it into the commit.
 */
const setAsideGeneratedChanges = async ({ cwd, paths, keepGenerated }: { cwd: string; paths: string[]; keepGenerated: boolean }) => {
	const failure = keepGenerated
		? await runOrDescribeFailure({ command: `git reset -q -- ${toLiteralPathspecs({ paths })}`, cwd })
		: await discardGeneratedChanges({ cwd, paths });
	const progress = keepGenerated
		? `kept ${paths.length} generated path(s) on disk, uncommitted — the pre-ship step commits build output`
		: `discarded ${paths.length} generated path(s) — the pre-ship step commits build output`;

	return failure === undefined ? { progress } : { error: `git could not ${keepGenerated ? 'unstage' : 'discard'} the generated changes in ${cwd}: ${failure}` };
};

/**
 * Generated changes never reach the commit: build output committed on a
 * feature branch snapshots the default branch and makes every later branch
 * conflict on it. The pre-ship step commits build output after the rebase.
 * By default they are discarded first; with `keepGenerated` they are unstaged
 * and excluded from staging, so they stay on disk uncommitted.
 *
 * `committed` reports only what this step did. Readiness is settled from the
 * branch's commits, so a resumed ticket committed by an earlier run still ships.
 *
 * The message is asked for after staging, so the agent sees untracked files,
 * and only when a commit will be made. It goes through a file so no ticket
 * title needs shell quoting.
 *
 * @returns the message committed under, so the caller can record the subject that actually landed
 */
export const commitWorkOrderWork = async ({
	cwd,
	composeMessage,
	runDir,
	generated = [],
	keepGenerated = false,
	onProgress,
}: Params): Promise<{ committed: false } | { committed: true; message: string } | CommitFailure> => {
	const changed = await readGitChangedFiles({ cwd });

	if (changed === undefined) {
		// Never read as "no changes": a commit cannot be promised over a tree
		// that cannot be read.
		return { error: `git could not read the tree at ${cwd}` };
	}

	const generatedPaths = changed.filter((path) => isGeneratedPath({ path, generated }));
	const sourcePaths = changed.filter((path) => !isGeneratedPath({ path, generated }));

	if (generatedPaths.length > 0) {
		const setAside = await setAsideGeneratedChanges({ cwd, paths: generatedPaths, keepGenerated });

		if (setAside.error !== undefined) {
			return { error: setAside.error };
		}

		onProgress?.(setAside.progress);
	}

	// A run whose only changes were build output has nothing to merge, and must
	// not reach `git commit` with an empty index.
	if (sourcePaths.length === 0) {
		return { committed: false };
	}

	// The pathspec keeps staging to the directory `readGitChangedFiles` reads: a
	// bare `git add -A` stages the whole repository, so a consumer nested in a
	// larger repo would commit files the run never saw. Kept build output is
	// excluded by its configured entries; git accepts an exclusion that matches
	// nothing, so an entry absent from disk never fails staging.
	const exclusions = keepGenerated && generated.length > 0 ? ` ${toLiteralPathspecs({ paths: generated, exclude: true })}` : '';
	const stageFailure = await runOrDescribeFailure({ command: `git add -A -- .${exclusions}`, cwd });

	if (stageFailure !== undefined) {
		return { error: `git could not stage the work in ${cwd}: ${stageFailure}` };
	}

	const message = await composeMessage({ cwd });
	const messagePath = join(runDir, 'commit-message.txt');

	await mkdir(runDir, { recursive: true });
	await writeFile(messagePath, message.endsWith('\n') ? message : `${message}\n`, 'utf8');

	const commitFailure = await runOrDescribeFailure({ command: `git commit -F ${quoteShellArgument({ argument: messagePath })}`, cwd });

	if (commitFailure !== undefined) {
		return { error: `git could not commit the work in ${cwd}: ${commitFailure}` };
	}

	return { committed: true, message };
};
