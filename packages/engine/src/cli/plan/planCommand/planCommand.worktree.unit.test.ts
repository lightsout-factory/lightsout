import { execSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/parseFlags.ts';
import { planCommand } from '#src/cli/plan/planCommand/planCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import type { WorktreeRecord } from '#src/contracts/worktree/WorktreeRecord.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { planWorkspaceFolder } from '#tests/helpers/planWorkspaceFolder.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';

// Mocked Imports
// -------------------------
// The sibling planCommand.unit.test.ts stubs the planning-worktree opener to pin
// routing. This suite runs the real opener and resolver under `plan workspace`,
// so the announcement, the untouched plan folder and the printed path are
// asserted as the command produces them. Only the git seams are mocked: the
// worktree module's barrel and the HEAD read. The directories are real, because
// every path comparison goes through `realpath`.
type WorktreeFailure = { error: string };

interface CreateParams {
	cwd: string;
	branch: string;
	startPoint: string;
	setup?: string;
	owner: WorktreeOwner;
	reuseExisting: boolean;
	onProgress?: (message: string) => void;
}

const mockCreateWorktree = jest.fn<(params: CreateParams) => Promise<string | WorktreeFailure>>();
const mockPrepareTicketBranch = jest.fn<(params: { cwd: string; branch: string }) => Promise<{ startPoint?: string } | WorktreeFailure>>();
const mockReadBranchWorktree = jest.fn<(params: { cwd: string; branch: string }) => Promise<string | undefined>>();
const mockReadWorktreeRecord = jest.fn<(params: { cwd: string; branch: string }) => Promise<WorktreeRecord | undefined>>();
const mockResolveWorktreePath = jest.fn<(params: { cwd: string; branch: string }) => Promise<string>>();

jest.mock('#src/worktree/createWorktree.ts', () => ({ createWorktree: (params: CreateParams) => mockCreateWorktree(params) }));
jest.mock('#src/worktree/prepareWorkOrderBranch/prepareWorkOrderBranch.ts', () => ({
	prepareWorkOrderBranch: (params: { cwd: string; branch: string }) => mockPrepareTicketBranch(params),
}));
jest.mock('#src/worktree/readBranchWorktree.ts', () => ({
	readBranchWorktree: (params: { cwd: string; branch: string }) => mockReadBranchWorktree(params),
}));
jest.mock('#src/worktree/records/readWorktreeRecord.ts', () => ({
	readWorktreeRecord: (params: { cwd: string; branch: string }) => mockReadWorktreeRecord(params),
}));
jest.mock('#src/worktree/resolveWorktreePath.ts', () => ({
	resolveWorktreePath: (params: { cwd: string; branch: string }) => mockResolveWorktreePath(params),
}));
// -------------------------
const mockReadGitHeadCommit = jest.fn<(params: { cwd: string }) => Promise<string | undefined>>();

jest.mock('#src/common/git/readGitHeadCommit.ts', () => ({
	readGitHeadCommit: (params: { cwd: string }) => mockReadGitHeadCommit(params),
}));
// -------------------------

const workOrderName = 'lo-131-plan-in-a-worktree';
const name = `${workOrderName}/001-plan-in-a-worktree`;
const launchingHead = '3f1c0de5a1b2c3d4e5f60718293a4b5c6d7e8f90';
const pinnedStartPoint = '0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d';
const setupCommand = 'pnpm install --frozen-lockfile';
const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };

/**
 * A launching checkout beside its worktrees root, running `plan workspace`.
 *
 * `launchFromTree` puts a tree at the plan's path before the command runs and
 * launches the command from inside it. `record` is the ownership record beside
 * the branch. `committed: false` is a launching
 * checkout with no commit, whose HEAD reads as nothing. `brainstorm` plants a
 * plan folder in the launching checkout.
 */
const setupWorkspace = async ({
	flags = [],
	launchFromTree = false,
	record,
	committed = true,
	brainstorm = false,
	workOrder = {},
}: {
	flags?: string[];
	launchFromTree?: boolean;
	record?: { owner: WorktreeOwner; startPoint?: string };
	committed?: boolean;
	brainstorm?: boolean;
	/**
	 * The work order record beside this plan's label. `branch` is what it
	 * stores — equal to the label by default, and a different string under a
	 * prefixed template. `'unclaimed'` writes no record at all, which is a
	 * `--name` nothing ever authored.
	 */
	workOrder?: { branch?: string } | 'unclaimed';
} = {}) => {
	const captured = captureCommandOutput();
	const root = await realpath(await freshCwd());
	const sourceCwd = join(root, 'launching-checkout');
	const tree = join(root, 'launching-checkout-worktrees', workOrderName);
	const sourcePlanDir = planWorkspaceFolder({ cwd: sourceCwd, name });

	await mkdir(sourceCwd, { recursive: true });
	// The branch a planning session is cut on is the work order record's answer.
	if (workOrder !== 'unclaimed') {
		seedWorkOrderRecord({ cwd: sourceCwd, name: workOrderName, branch: workOrder.branch });
	}

	await writeFile(join(sourceCwd, 'lightsout.config.json'), JSON.stringify({ gates, worktree: { setup: setupCommand } }));

	if (launchFromTree) {
		await mkdir(tree, { recursive: true });
		// Launched from inside the tree, which is no git worktree here, so its own
		// directory is where the record is looked for.
		if (workOrder !== 'unclaimed') {
			seedWorkOrderRecord({ cwd: tree, name: workOrderName, branch: workOrder.branch });
		}
	}

	if (brainstorm) {
		await mkdir(sourcePlanDir, { recursive: true });
		await writeFile(join(sourcePlanDir, 'brainstorm-notes.md'), '# Brainstorm notes\n');
		await writeFile(join(sourcePlanDir, 'brainstorm-decisions.json'), '{"decisions":[]}\n');
	}

	mockResolveWorktreePath.mockResolvedValue(tree);
	mockReadBranchWorktree.mockResolvedValue(launchFromTree ? tree : undefined);
	mockReadWorktreeRecord.mockResolvedValue(
		record === undefined ? undefined : { branch: workOrderName, worktreePath: tree, createdAt: '2026-09-01T09:00:00.000Z', ...record },
	);
	mockPrepareTicketBranch.mockResolvedValue({});
	mockReadGitHeadCommit.mockResolvedValue(committed ? launchingHead : undefined);
	// The cut itself: git would make the directory, so the mock does.
	mockCreateWorktree.mockImplementation(async () => {
		await mkdir(tree, { recursive: true });

		return tree;
	});

	const args = ['workspace', '--name', name, ...flags];
	const cwd = launchFromTree ? tree : sourceCwd;

	return { context: { flags: parseFlags({ args }), rest: args, cwd }, sourceCwd, tree, sourcePlanDir, ...captured };
};

/**
 * The same launching checkout, running `plan workspace` for a plan addressed
 * inside its ticket folder — `lo-7-search/002-ranking`, whose plan folder is the
 * only thing the checkout holds.
 *
 * Nothing holds the ticket branch and no ownership record names it, so the
 * command cuts a fresh tree, and the ticket branch needs no move, so the branch
 * preparation answers no start point of its own.
 */

/**
 * A real primary checkout running `plan workspace`, whose cut is a real linked
 * worktree beside it — the one shape in which the plan folder could be resolved
 * inside the tree rather than under the checkout that launched the command.
 *
 * Git answers which checkout is primary, so the repo and the tree are real; the
 * cut itself stays behind the mocked `createWorktree`, which adds the worktree.
 */
const setupLinkedPlanningTree = async () => {
	const captured = captureCommandOutput();
	const sourceCwd = realpathSync(setupBranchRepo().cwd);
	const tree = join(`${sourceCwd}-worktrees`, workOrderName);

	seedWorkOrderRecord({ cwd: sourceCwd, name: workOrderName });
	await writeFile(join(sourceCwd, 'lightsout.config.json'), JSON.stringify({ gates }));

	mockResolveWorktreePath.mockResolvedValue(tree);
	mockReadBranchWorktree.mockResolvedValue(undefined);
	mockReadWorktreeRecord.mockResolvedValue(undefined);
	mockPrepareTicketBranch.mockResolvedValue({});
	mockReadGitHeadCommit.mockResolvedValue(launchingHead);
	mockCreateWorktree.mockImplementation(async ({ branch }) => {
		execSync(`git worktree add -q -b ${branch} "${tree}" main`, { cwd: sourceCwd, stdio: 'ignore' });

		return tree;
	});

	const args = ['workspace', '--name', name];

	return { context: { flags: parseFlags({ args }), rest: args, cwd: sourceCwd }, sourceCwd, tree, ...captured };
};

/** The files a plan folder holds, read back by name. */
const readPlanFolder = async ({ dir }: { dir: string }) => ({
	notes: await readFile(join(dir, 'brainstorm-notes.md'), 'utf8'),
	decisions: await readFile(join(dir, 'brainstorm-decisions.json'), 'utf8'),
});

describe('planCommand', () => {
	test('cuts the plan worktree at the launching HEAD, leaves the plan folder in the launching checkout, and prints its path last', async () => {
		const { context, tree, sourcePlanDir, logged, errors, exitCodes } = await setupWorkspace({ brainstorm: true });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		const original = await readPlanFolder({ dir: sourcePlanDir });
		// the launching checkout's own config decides the setup a new planning tree runs
		expect(mockCreateWorktree).toHaveBeenCalledWith(expect.objectContaining({ startPoint: launchingHead, owner: 'plan', setup: setupCommand }));
		// one announcement naming the tree and its branch, the plan folder, then the
		// path alone; this fixture's checkout is no git repository, so the folder
		// resolves against the tree the command runs in
		expect(logged).toEqual([expect.stringContaining(tree), `plan folder: ${await planWorkspaceDir({ cwd: tree, name })}`, tree]);
		expect(logged[0]).toContain(`branch: ${workOrderName}`);
		// the tree holds code work only, so nothing was copied into it and the
		// launching checkout's folder is exactly as it was
		expect(existsSync(join(tree, '.lightsout', 'work-orders'))).toBe(false);
		expect(original).toStrictEqual({ notes: '# Brainstorm notes\n', decisions: '{"decisions":[]}\n' });
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('launched from inside the tree, answers it with no announcement, because the session moved nowhere', async () => {
		const { context, tree, logged, exitCodes } = await setupWorkspace({ launchFromTree: true });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual([`plan folder: ${await planWorkspaceDir({ cwd: tree, name })}`, tree]);
		expect(mockCreateWorktree).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([0]);
	});

	test('with --no-worktree, prints the launching checkout and asks git nothing', async () => {
		const { context, sourceCwd, logged, exitCodes } = await setupWorkspace({ flags: ['--no-worktree'], brainstorm: true });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual([`plan folder: ${await planWorkspaceDir({ cwd: sourceCwd, name })}`, sourceCwd]);
		expect(mockResolveWorktreePath).not.toHaveBeenCalled();
		expect(mockCreateWorktree).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([0]);
	});

	test('re-cuts a deleted planning tree at the commit its record pinned, not at the launching HEAD', async () => {
		const { context, tree, logged, exitCodes } = await setupWorkspace({ record: { owner: 'plan', startPoint: pinnedStartPoint } });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockCreateWorktree).toHaveBeenCalledWith(expect.objectContaining({ branch: workOrderName, startPoint: pinnedStartPoint }));
		expect(logged.at(-1)).toBe(tree);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('refuses a --name no work order claims, naming the work order rather than planning on a branch nothing authored', async () => {
		const { context, logged, errors, exitCodes } = await setupWorkspace({ workOrder: 'unclaimed' });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors).toEqual([expect.stringContaining(workOrderName)]);
		expect(errors).toEqual([expect.stringContaining('--no-worktree')]);
		expect(logged).toStrictEqual([]);
		expect(mockCreateWorktree).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('cuts the tree on the branch the record stores, not on the plan address’s first segment', async () => {
		const { context, logged, exitCodes } = await setupWorkspace({ workOrder: { branch: 'feature/lo-131-plan-in-a-worktree' } });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		// The label names the work order to look up; the branch is whatever its
		// record stores, and under a prefixed template those are two strings.
		expect(mockCreateWorktree).toHaveBeenCalledWith(expect.objectContaining({ branch: 'feature/lo-131-plan-in-a-worktree' }));
		expect(logged[0]).toContain('branch: feature/lo-131-plan-in-a-worktree');
		expect(exitCodes).toStrictEqual([0]);
	});

	test('refuses a launching checkout with no commit to plan from, naming the path and printing none', async () => {
		const { context, tree, logged, errors, exitCodes } = await setupWorkspace({ committed: false });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors).toEqual([expect.stringContaining(tree)]);
		expect(errors).toEqual([expect.stringContaining('--no-worktree')]);
		expect(logged).toStrictEqual([]);
		expect(mockCreateWorktree).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('prints the plan folder under the launching checkout, never inside the tree it cut', async () => {
		const { context, sourceCwd, tree, logged, exitCodes } = await setupLinkedPlanningTree();

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		const planFolderLine = logged.at(-2) ?? '';
		expect({ planFolderLine, insideTree: planFolderLine.includes(tree), last: logged.at(-1), exitCodes }).toStrictEqual({
			planFolderLine: `plan folder: ${planWorkspaceFolder({ cwd: sourceCwd, name })}`,
			insideTree: false,
			last: tree,
			exitCodes: [0],
		});
	});
});
