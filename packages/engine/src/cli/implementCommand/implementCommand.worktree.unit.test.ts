import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { implementCommand } from '#src/cli/implementCommand/implementCommand.ts';
import { parseFlags } from '#src/cli/parseFlags.ts';
import type { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The worktree module is the only place the workspace resolution touches git,
// and the temp repo these cases run in has no remote. Doubling it leaves the
// resolver, the branch derivation, the input copy and the record links running
// for real, which is what these cases are about: which checkout each step after
// the resolution is handed.
interface CreateWorktreeParams {
	cwd: string;
	branch: string;
	startPoint: string;
	setup?: string;
	owner: WorktreeOwner;
	reuseExisting: boolean;
	onProgress?: (message: string) => void;
}

const mockCreateWorktree = jest.fn<(params: CreateWorktreeParams) => Promise<string | { error: string }>>();
const mockFetchDefaultBranch = jest.fn<(params: { cwd: string }) => Promise<string | { error: string }>>();
const mockReadBranchWorktree = jest.fn<(params: { cwd: string; branch: string }) => Promise<string | undefined>>();

jest.mock('#src/worktree/createWorktree.ts', () => ({ createWorktree: (params: CreateWorktreeParams) => mockCreateWorktree(params) }));
jest.mock('#src/worktree/fetchDefaultBranch.ts', () => ({ fetchDefaultBranch: (params: { cwd: string }) => mockFetchDefaultBranch(params) }));
jest.mock('#src/worktree/readBranchWorktree.ts', () => ({
	readBranchWorktree: (params: { cwd: string; branch: string }) => mockReadBranchWorktree(params),
}));
// -------------------------
// The three steps that follow the resolution, doubled so the checkout each one
// received is readable — that is the whole claim these cases make. Only the
// fields they assert on are named; the command forwards the rest untouched.
interface LifecycleParams {
	cwd: string;
}

interface PipelineParams {
	cwd: string;
	planPath: string;
}

interface ShipTailParams {
	cwd: string;
	result: PipelineResult;
}

const mockRequireImplementLifecycle = jest.fn<(params: LifecycleParams) => Promise<string | undefined>>();

jest.mock('#src/ticketLifecycle/requireImplementLifecycle.ts', () => ({
	requireImplementLifecycle: (params: LifecycleParams) => mockRequireImplementLifecycle(params),
}));
// -------------------------
const mockRunPipelineOrFailFast = jest.fn<(params: PipelineParams) => Promise<PipelineResult>>();

jest.mock('#src/cli/common/runPipelineOrFailFast.ts', () => ({
	runPipelineOrFailFast: (params: PipelineParams) => mockRunPipelineOrFailFast(params),
}));
// -------------------------
const mockRunPhasesOrFailFast = jest.fn<(params: { cwd: string; overviewPath: string }) => Promise<PipelineResult>>();

jest.mock('#src/cli/common/runPhasesOrFailFast.ts', () => ({
	runPhasesOrFailFast: (params: { cwd: string; overviewPath: string }) => mockRunPhasesOrFailFast(params),
}));
// -------------------------
const mockShipAfterImplement = jest.fn<(params: ShipTailParams) => Promise<number>>();

jest.mock('#src/cli/common/implementRun/finishImplementRun/shipAfterImplement/shipAfterImplement.ts', () => ({
	shipAfterImplement: (params: ShipTailParams) => mockShipAfterImplement(params),
}));
// -------------------------
// The report card is silenced rather than asserted: it reads a run directory no
// mocked pipeline ever wrote, and its lines would sit between the startup lines
// these cases read.
const mockRenderResult = jest.fn<(params: { result: PipelineResult; cwd: string }) => Promise<string[]>>();

jest.mock('#src/cli/common/implementRun/finishImplementRun/renderResult/renderResult.ts', () => ({
	renderResult: (params: { result: PipelineResult; cwd: string }) => mockRenderResult(params),
}));
// -------------------------
// The report is saved under the run's folder, and the run here is a result no
// pipeline wrote to disk, so the save is doubled rather than refused.
jest.mock('#src/runState/finalReport/writeRunFinalReport.ts', () => ({
	writeRunFinalReport: () => Promise.resolve(),
}));
// -------------------------

/** The plan folder every case points `--plan` at, and the branch its name yields. */
const planFolder = join('.lightsout', 'work-orders', 'lo-42-add-widgets', 'plans', '001-add-widgets');
const branch = 'lo-42-add-widgets';

/** What the plan says when the run starts. */
const planBody = '# Plan: add widgets\n';

/** What the plan file at the repo root says — the loose input a `--plan` outside the plans directory names. */
const loosePlanBody = '# Plan: a note nobody filed under a ticket\n';

/**
 * A run that passed. Nothing downstream of the pipeline is real here — the
 * report card and the ship tail are both doubled — so the result only has to be
 * the same object each of them is handed.
 */
const passedResult = { ok: true, manifest: { runId: 'aaaaaaaa-1111-2222-3333-444444444444' } } as unknown as PipelineResult;

/**
 * A real consumer repo holding a real plan folder, and a real directory standing
 * in for the worktree git would have cut.
 *
 * The workspace is a real linked worktree cut from that repo, because that is
 * the only shape in which a plan path resolves the way it does in a real run:
 * the plan folder stays in the checkout the command was launched from, and the
 * tree reaches it by resolving its own primary checkout.
 *
 * The repo also carries a plan file at its root, outside the plans directory,
 * which is the loose input a case pointing `--plan` at a plain file names.
 *
 * `fetchFailure` is how a workspace that cannot be resolved becomes observable.
 */
const setupImplementWorktree = ({
	args,
	fetchFailure,
	phased = false,
	storedBranch = branch,
}: {
	args: string[];
	fetchFailure?: string;
	/** A plan folder holding an overview.md, so the run is every phase of one plan rather than a single one. */
	phased?: boolean;
	/** The branch the work order's record stores. Equal to its label by default, and a different string under a prefixed template. */
	storedBranch?: string;
}) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ plan: loosePlanBody });
	const workspace = join(mkdtempSync(join(tmpdir(), 'lightsout-workspace-')), 'tree');
	const printedBeforeLifecycle: string[] = [];

	execSync(`git worktree add -q --detach "${workspace}"`, { cwd, stdio: 'ignore' });

	// The branch an isolated run builds on is the work order record's answer, so
	// the record for this plan's work order stands on disk before the command runs.
	seedWorkOrderRecord({
		cwd,
		name: 'lo-42-add-widgets',
		branch: storedBranch,
		ticketRef: 'lo-42',
		plans: [{ id: '001-add-widgets', title: 'Add widgets', progress: 'ready', createdAt: '2026-01-01T00:00:00.000Z' }],
	});
	mkdirSync(join(cwd, planFolder), { recursive: true });
	writeFileSync(join(cwd, planFolder, phased ? 'overview.md' : 'plan.md'), planBody);

	if (phased) {
		writeFileSync(join(cwd, planFolder, 'phase1-add-widgets.md'), planBody);
	}

	mockFetchDefaultBranch.mockResolvedValue(fetchFailure === undefined ? 'main' : { error: fetchFailure });
	mockReadBranchWorktree.mockResolvedValue(undefined);
	mockCreateWorktree.mockResolvedValue(workspace);
	mockRequireImplementLifecycle.mockImplementation(() => {
		printedBeforeLifecycle.push(...captured.logged);

		return Promise.resolve(undefined);
	});
	mockRunPipelineOrFailFast.mockResolvedValue(passedResult);
	mockRunPhasesOrFailFast.mockResolvedValue(passedResult);
	mockRenderResult.mockResolvedValue([]);
	mockShipAfterImplement.mockResolvedValue(0);

	return { context: { flags: parseFlags({ args }), rest: [], cwd }, cwd, workspace, printedBeforeLifecycle, ...captured };
};

describe('implementCommand worktree isolation', () => {
	test('names the workspace and branch before any source work and runs there', async () => {
		const { context, workspace, printedBeforeLifecycle } = setupImplementWorktree({ args: ['--plan', planFolder] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		// the announcement is what a reader follows the run by, so it has to be on
		// the screen before the ticket write and before the pipeline — matched
		// loosely, because the sentence around them is human copy
		expect(printedBeforeLifecycle.join('\n')).toContain(workspace);
		expect(printedBeforeLifecycle.join('\n')).toContain(branch);
		expect(mockRunPipelineOrFailFast).toHaveBeenCalledWith(expect.objectContaining({ cwd: workspace }));
	});

	test('runs the pipeline against the plan folder the launching checkout holds, copying none of it in', async () => {
		const { context, cwd, workspace } = setupImplementWorktree({ args: ['--plan', planFolder] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockRunPipelineOrFailFast).toHaveBeenCalledWith(expect.objectContaining({ cwd: workspace, planPath: join(planFolder, 'plan.md') }));
		// the folder stayed where it was, so the tree coming down takes no copy of
		// it — and the shape of the plan was read from the folder that really holds it
		expect(readFileSync(join(cwd, planFolder, 'plan.md'), 'utf8')).toBe(planBody);
		expect(existsSync(join(workspace, planFolder))).toBe(false);
	});

	test('refuses to isolate a plan file outside the plans directory, because it names no work order', async () => {
		const { context, errors, exitCodes } = setupImplementWorktree({ args: ['--plan', 'plan.md'] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		// A loose file is nobody's plan folder, so no work order's record says which
		// branch it implements on — and deriving one from the file's stem is exactly
		// the second author of a branch a record exists to remove.
		expect(errors.join('\n')).toContain("no branch could be resolved from 'plan.md'");
		expect(errors.join('\n')).toContain('--no-worktree');
		expect(mockRunPipelineOrFailFast).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('builds on the branch the work order’s record stores, not on the plan address’s first segment', async () => {
		const { context, printedBeforeLifecycle } = setupImplementWorktree({ args: ['--plan', planFolder], storedBranch: 'feature/lo-42-add-widgets' });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		// Under a prefixed branch template the label and the branch are different
		// strings, and only the record says which is which: the address names the
		// work order, the record names the branch its plans implement on.
		expect(mockCreateWorktree).toHaveBeenCalledWith(expect.objectContaining({ branch: 'feature/lo-42-add-widgets' }));
		expect(printedBeforeLifecycle.join('\n')).toContain('feature/lo-42-add-widgets');
	});

	test('builds in the launching checkout when the run opts out', async () => {
		const { context, cwd } = setupImplementWorktree({ args: ['--plan', planFolder, '--no-worktree'] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockCreateWorktree).not.toHaveBeenCalled();
		expect(mockRequireImplementLifecycle).toHaveBeenCalledWith(expect.objectContaining({ cwd }));
		expect(mockRunPipelineOrFailFast).toHaveBeenCalledWith(expect.objectContaining({ cwd, planPath: join(planFolder, 'plan.md') }));
		expect(mockShipAfterImplement).toHaveBeenCalledWith(expect.objectContaining({ cwd }));
	});

	test('exits on a workspace refusal without starting the run', async () => {
		const { context, errors, exitCodes } = setupImplementWorktree({
			args: ['--plan', planFolder],
			fetchFailure: 'git could not fetch origin: no remote named origin',
		});

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toMatch(/fetch/iu);
		expect(mockRequireImplementLifecycle).not.toHaveBeenCalled();
		expect(mockRunPipelineOrFailFast).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('refuses an impossible flag combination before creating a worktree', async () => {
		// --start-phase against a folder holding one plan.md: a refusal the flags
		// alone decide, which must land before a tree is cut for a run that cannot happen
		const { context, errors, exitCodes } = setupImplementWorktree({ args: ['--plan', planFolder, '--start-phase', '2'] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toContain('--start-phase');
		expect(mockFetchDefaultBranch).not.toHaveBeenCalled();
		expect(mockCreateWorktree).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([1]);
	});

	test('runs every phase of a plan folder in the workspace, not in the launching checkout', async () => {
		const { context, workspace } = setupImplementWorktree({ args: ['--plan', planFolder], phased: true });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockRunPhasesOrFailFast).toHaveBeenCalledWith(expect.objectContaining({ cwd: workspace, overviewPath: join(planFolder, 'overview.md') }));
		expect(mockRunPipelineOrFailFast).not.toHaveBeenCalled();
	});
});
