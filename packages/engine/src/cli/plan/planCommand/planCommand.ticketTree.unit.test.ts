import { existsSync } from 'node:fs';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
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
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

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

const launchingHead = '3f1c0de5a1b2c3d4e5f60718293a4b5c6d7e8f90';
const setupCommand = 'pnpm install --frozen-lockfile';
const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };

/**
 * A launching checkout beside its worktrees root, running `plan workspace` for a plan addressed
 * inside its ticket folder — `lo-7-search/002-ranking`, whose plan folder is the
 * only thing the checkout holds.
 *
 * Nothing holds the ticket branch and no ownership record names it, so the
 * command cuts a fresh tree, and the ticket branch needs no move, so the branch
 * preparation answers no start point of its own.
 */
const setupTicketPlanWorkspace = async () => {
	const captured = captureCommandOutput();
	const root = await realpath(await freshCwd());
	const sourceCwd = join(root, 'launching-checkout');
	const tree = join(root, 'launching-checkout-worktrees', 'lo-7-search');
	const sourcePlanDir = join(sourceCwd, '.lightsout', 'work-orders', 'lo-7-search', 'plans', '002-ranking');

	await mkdir(sourcePlanDir, { recursive: true });
	seedWorkOrderRecord({ cwd: sourceCwd, name: 'lo-7-search' });
	await writeFile(join(sourceCwd, 'lightsout.config.json'), JSON.stringify({ gates, worktree: { setup: setupCommand } }));
	await writeFile(join(sourcePlanDir, 'brainstorm-notes.md'), '# Brainstorm notes\n');
	await writeFile(join(sourcePlanDir, 'brainstorm-decisions.json'), '{"decisions":[]}\n');

	mockResolveWorktreePath.mockResolvedValue(tree);
	mockReadBranchWorktree.mockResolvedValue(undefined);
	mockReadWorktreeRecord.mockResolvedValue(undefined);
	mockPrepareTicketBranch.mockResolvedValue({});
	mockReadGitHeadCommit.mockResolvedValue(launchingHead);
	// The cut itself: git would make the directory, so the mock does.
	mockCreateWorktree.mockImplementation(async () => {
		await mkdir(tree, { recursive: true });

		return tree;
	});

	const args = ['workspace', '--name', 'lo-7-search/002-ranking'];

	return { context: { flags: parseFlags({ args }), rest: args, cwd: sourceCwd }, sourceCwd, tree, ...captured };
};

/**
 * The same launching checkout and plan address, with a tree already standing at
 * the TICKET branch's path — the tree an earlier plan of this ticket was
 * planned and built in.
 *
 * `owner` is what that tree's ownership record names. `heldBy` plants a live
 * run lock inside it, this process's own pid being the one lock a test can
 * prove alive, which is what says a run is still editing the tree rather than
 * having finished with it.
 */
const setupStandingTicketTree = async ({ owner, heldBy }: { owner: WorktreeOwner; heldBy?: string }) => {
	const captured = captureCommandOutput();
	const root = await realpath(await freshCwd());
	const sourceCwd = join(root, 'launching-checkout');
	const tree = join(root, 'launching-checkout-worktrees', 'lo-7-search');
	const sourcePlanDir = join(sourceCwd, '.lightsout', 'work-orders', 'lo-7-search', 'plans', '002-ranking');

	await mkdir(sourcePlanDir, { recursive: true });
	await mkdir(tree, { recursive: true });
	seedWorkOrderRecord({ cwd: sourceCwd, name: 'lo-7-search' });
	await writeFile(join(sourceCwd, 'lightsout.config.json'), JSON.stringify({ gates }));
	await writeFile(join(sourcePlanDir, 'brainstorm-notes.md'), '# Brainstorm notes\n');
	await writeFile(join(sourcePlanDir, 'brainstorm-decisions.json'), '{"decisions":[]}\n');

	if (heldBy !== undefined) {
		await mkdir(join(tree, '.lightsout'), { recursive: true });
		await writeFile(join(tree, '.lightsout', 'lock.json'), JSON.stringify({ pid: process.pid, runId: heldBy, startedAt: '2026-09-11T09:00:00.000Z' }));
	}

	mockResolveWorktreePath.mockResolvedValue(tree);
	mockReadBranchWorktree.mockResolvedValue(tree);
	mockReadWorktreeRecord.mockResolvedValue({ branch: 'lo-7-search', owner, worktreePath: tree, createdAt: '2026-09-01T09:00:00.000Z' });
	mockPrepareTicketBranch.mockResolvedValue({});
	mockReadGitHeadCommit.mockResolvedValue(launchingHead);

	const args = ['workspace', '--name', 'lo-7-search/002-ranking'];

	return { context: { flags: parseFlags({ args }), rest: args, cwd: sourceCwd }, sourceCwd, tree, ...captured };
};

describe('planCommand', () => {
	test("a plan address cuts its tree on the ticket branch and leaves that plan's folder where it is", async () => {
		const { context, sourceCwd, tree, logged, errors, exitCodes } = await setupTicketPlanWorkspace();

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		// the tree and the branch it stands on are the ticket folder's, never the plan address
		expect(mockResolveWorktreePath).toHaveBeenCalledWith({ cwd: sourceCwd, branch: 'lo-7-search' });
		expect(mockCreateWorktree).toHaveBeenCalledWith(expect.objectContaining({ branch: 'lo-7-search', owner: 'plan' }));
		// one announcement naming the tree and its branch, the plan folder, then the
		// path alone; this fixture's checkout is no git repository, so the folder
		// resolves against the tree the command runs in
		expect(logged).toEqual([expect.stringContaining(tree), `plan folder: ${await planWorkspaceDir({ cwd: tree, name: 'lo-7-search/002-ranking' })}`, tree]);
		expect(logged[0]).toMatch(/branch: lo-7-search$/);
		expect(existsSync(join(tree, '.lightsout', 'work-orders'))).toBe(false);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a later plan continues in the ticket tree an implementation run owns, carrying no plan folder into it', async () => {
		const { context, tree, logged, errors, exitCodes } = await setupStandingTicketTree({ owner: 'implement' });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		// the tree an earlier plan's run adopted is where the next plan belongs, so
		// nothing is cut and the path is answered as it stands
		expect(mockCreateWorktree).not.toHaveBeenCalled();
		expect(logged.at(-1)).toBe(tree);
		expect(existsSync(join(tree, '.lightsout', 'work-orders'))).toBe(false);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('refuses a later plan while a live run holds the ticket tree, naming the run and printing no path', async () => {
		const { context, tree, logged, errors, exitCodes } = await setupStandingTicketTree({ owner: 'plan', heldBy: 'run-ranking-in-flight' });

		await expect(planCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors).toEqual([expect.stringContaining(tree)]);
		expect(errors).toEqual([expect.stringContaining('run-ranking-in-flight')]);
		expect(errors).toEqual([expect.stringContaining('--no-worktree')]);
		expect(logged).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([1]);
	});
});
