import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CommitFailure } from '#src/commit/internal/common/types/CommitFailure.ts';
import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import { runOrDescribeFailure } from '#src/common/processes/runOrDescribeFailure.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';

interface Params {
	cwd: string;
	/** Writes the commit's message from what is staged. Called once, after the generated paths are discarded and the source changes staged, and only when there is something to commit. */
	composeMessage: ({ cwd }: { cwd: string }) => Promise<string>;
	/** Run directory the message file is written into — inside `.lightsout`, which is gitignored. */
	runDir: string;
	/**
	 * The config's `generated` path prefixes. A change under one of these is
	 * discarded rather than committed: the pre-ship step at merge time is the one
	 * place build output enters history, and it runs after the rebase.
	 */
	generated?: string[];
	/** Live progress sink — one line when generated changes were discarded. */
	onProgress?: (message: string) => void;
}

/** Git's `:(literal)` magic stops a file named `[slug].tsx` being read as a pattern. */
const toPathspecs = ({ paths }: { paths: string[] }) => paths.map((path) => quoteShellArgument({ argument: `:(literal)${path}` })).join(' ');

/** @returns git's own words when it refused, or undefined once the tree is clean of them */
const discardGeneratedChanges = async ({ cwd, paths }: { cwd: string; paths: string[] }) => {
	const pathspecs = toPathspecs({ paths });
	// The index is reset first because `git checkout --` restores the worktree
	// from the index, and a refused earlier attempt can leave stale build output
	// staged there.
	const resetFailure = await runOrDescribeFailure({ command: `git reset -q -- ${pathspecs}`, cwd });

	if (resetFailure !== undefined) {
		return resetFailure;
	}

	// `--full-name` is deliberately absent: `git ls-files` prints paths relative
	// to `cwd`, the same frame `readGitChangedFiles` returns.
	const listed = await runCommand({ command: `git ls-files -z -- ${pathspecs}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (listed?.exitCode !== 0) {
		return 'git could not tell which generated paths are tracked';
	}

	const tracked = listed.stdout.split('\0').filter(Boolean);
	const untracked = paths.filter((path) => !tracked.includes(path));
	// Each command is skipped when its side is empty, so neither is handed a
	// pathspec it cannot match. `git clean` omits `-x`: an ignored file could not
	// have reached the commit anyway.
	const commands = [
		...(tracked.length > 0 ? [`git checkout -- ${toPathspecs({ paths: tracked })}`] : []),
		...(untracked.length > 0 ? [`git clean -fdq -- ${toPathspecs({ paths: untracked })}`] : []),
	];

	for (const command of commands) {
		const failure = await runOrDescribeFailure({ command, cwd });

		if (failure !== undefined) {
			return failure;
		}
	}

	return undefined;
};

/**
 * Generated changes are discarded first: build output committed on a feature
 * branch snapshots the default branch and makes every later branch conflict on
 * it. The pre-ship step commits build output after the rebase.
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
		const discardFailure = await discardGeneratedChanges({ cwd, paths: generatedPaths });

		if (discardFailure !== undefined) {
			return { error: `git could not discard the generated changes in ${cwd}: ${discardFailure}` };
		}

		onProgress?.(`discarded ${generatedPaths.length} generated path(s) — the pre-ship step commits build output`);
	}

	// A run whose only changes were build output has nothing to merge, and must
	// not reach `git commit` with an empty index.
	if (sourcePaths.length === 0) {
		return { committed: false };
	}

	// The pathspec keeps staging to the directory `readGitChangedFiles` reads: a
	// bare `git add -A` stages the whole repository, so a consumer nested in a
	// larger repo would commit files the run never saw.
	const stageFailure = await runOrDescribeFailure({ command: 'git add -A -- .', cwd });

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
