import { stat } from 'node:fs/promises';
import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import { runOrDescribeFailure } from '#src/common/processes/runOrDescribeFailure.ts';
import type { WorktreeFailure } from '#src/common/types/WorktreeFailure.ts';
import type { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import { readWorktreeRecord } from '#src/worktree/records/readWorktreeRecord.ts';
import { writeWorktreeRecord } from '#src/worktree/records/writeWorktreeRecord.ts';
import { resolveWorktreePath } from '#src/worktree/resolveWorktreePath.ts';

interface Params {
	/** The checkout git runs in — the primary checkout, never the tree being made. */
	cwd: string;
	branch: string;
	/** What a new branch is cut from, composed by the caller — `origin/<default>` for a queue or implement tree, a commit sha for a planning tree. Unused for a branch that already exists, which is adopted at its own tip. */
	startPoint: string;
	/** Config `worktree.setup`, run inside the fresh tree. Skipped when undefined. */
	setup?: string;
	/** Who this tree belongs to, recorded durably so a later drain can tell. */
	owner: WorktreeOwner;
	/** True continues in a directory already sitting at the path, provided its ownership record does not name a different owner; false refuses any directory already there. */
	reuseExisting: boolean;
	onProgress?: (message: string) => void;
}

const exists = async ({ path }: { path: string }) => {
	const found = await stat(path).catch(() => undefined);

	return found !== undefined;
};

const branchExists = async ({ cwd, branch }: { cwd: string; branch: string }) => {
	const ref = quoteShellArgument({ argument: `refs/heads/${branch}` });
	const shown = await runCommand({ command: `git rev-parse --verify --quiet ${ref}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return shown?.exitCode === 0;
};

/**
 * A standalone run's tree and a drain's tree for one ticket share one path and branch, so only the
 * ownership record tells them apart; asked here in the creator so no caller can forget it. A tree
 * with no record predates ownership records and is continued in.
 */
const describeClaim = async ({ cwd, branch, owner, worktreePath }: { cwd: string; branch: string; owner: WorktreeOwner; worktreePath: string }) => {
	const record = await readWorktreeRecord({ cwd, branch });

	return record === undefined || record.owner === owner
		? undefined
		: `the worktree at ${worktreePath} belongs to a '${record.owner}' run, so it was left alone`;
};

/** Ownership is recorded before setup runs, so a failed setup still leaves a tree a later run can attribute rather than adopt. */
const cutTree = async ({
	cwd,
	branch,
	startPoint,
	setup,
	owner,
	worktreePath,
	onProgress,
}: {
	cwd: string;
	branch: string;
	startPoint: string;
	setup?: string;
	owner: WorktreeOwner;
	worktreePath: string;
	onProgress?: (message: string) => void;
}) => {
	const adopting = await branchExists({ cwd, branch });
	const [path, name, base] = [worktreePath, branch, startPoint].map((argument) => quoteShellArgument({ argument }));
	const add = adopting ? `git worktree add ${path} ${name}` : `git worktree add ${path} -b ${name} ${base}`;
	const addFailure = await runOrDescribeFailure({ command: add, cwd });

	if (addFailure !== undefined) {
		return { error: `git could not create a worktree for '${branch}': ${addFailure}` };
	}

	onProgress?.(`worktree ${worktreePath} on ${branch}`);
	// An adopted branch stands at its own tip and was never cut at `startPoint`,
	// so its record carries none — a record naming a commit the tree never stood
	// on would re-create it at the wrong one.
	await writeWorktreeRecord({ cwd, branch, owner, worktreePath, startPoint: adopting ? undefined : startPoint, onProgress });

	if (setup === undefined) {
		return undefined;
	}

	// An install is the slowest thing that happens here, and the git ceiling is
	// far too tight for it.
	const setupTimeoutMs = 600_000;
	const setupFailure = await runOrDescribeFailure({ command: setup, cwd: worktreePath, timeoutMs: setupTimeoutMs, subject: 'the command' });

	if (setupFailure !== undefined) {
		// An agent turned loose in a tree with no dependencies fails every gate
		// for the wrong reason, so a failed setup is the end of this ticket.
		return { error: `the queue's setup command failed in ${worktreePath}: ${setupFailure}` };
	}

	onProgress?.(`setup finished in ${worktreePath}`);

	return undefined;
};

/**
 * No `git fetch` here: every caller fetches first, and the queue's serialized creation chain keeps
 * concurrent tickets from racing git in the main checkout. An existing branch with no worktree is
 * adopted rather than refused, because branch-per-ticket workflows pre-make it, and the ship step
 * catches a stale base.
 */
export const createWorktree = async ({ cwd, branch, startPoint, setup, owner, reuseExisting, onProgress }: Params): Promise<string | WorktreeFailure> => {
	const worktreePath = await resolveWorktreePath({ cwd, branch });
	const alreadyThere = await exists({ path: worktreePath });

	if (alreadyThere && !reuseExisting) {
		return { error: `something is already at ${worktreePath}, so no worktree was made for '${branch}'` };
	}

	const claimed = alreadyThere ? await describeClaim({ cwd, branch, owner, worktreePath }) : undefined;

	if (claimed !== undefined) {
		return { error: claimed };
	}

	if (alreadyThere) {
		onProgress?.(`worktree already at ${worktreePath} — continuing in it`);
	}

	const failure = alreadyThere ? undefined : await cutTree({ cwd, branch, startPoint, setup, owner, worktreePath, onProgress });

	return failure ?? worktreePath;
};
