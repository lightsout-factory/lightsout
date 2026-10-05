import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { buildActivityTree } from '#src/activity/buildActivityTree/buildActivityTree.ts';
import { readActivityMarks } from '#src/activity/readActivityMarks.ts';
import { implementCommand } from '#src/cli/implementCommand/implementCommand.ts';
import { parseFlags } from '#src/cli/parseFlags.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// What an `implement` run leaves in the plan folder's activity record: its own
// command run under the plan level, and nothing at all for a run whose plan is
// not a plan folder. The record itself is written for real here — only the
// pipeline and the seams around it are doubled — because where the marks land
// is the whole claim.

// Mocked Imports
// -------------------------
// The worktree module is the only place the workspace resolution touches git,
// and the temp repo these cases run in has no remote. Doubling it leaves the
// plans-directory resolution, the branch derivation and the input copy running
// for real, which is what decides where the record is written.
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
const mockRequireImplementLifecycle = jest.fn<(params: { cwd: string }) => Promise<string | undefined>>();

jest.mock('#src/ticketLifecycle/requireImplementLifecycle.ts', () => ({
	requireImplementLifecycle: (params: { cwd: string }) => mockRequireImplementLifecycle(params),
}));
// -------------------------
// The pipeline itself: doubled so the run ends in one step with a manifest
// whose status is the outcome the command run's end mark has to carry.
const mockRunPipelineOrFailFast = jest.fn<(params: { cwd: string; planPath: string }) => Promise<PipelineResult>>();

jest.mock('#src/cli/common/runPipelineOrFailFast.ts', () => ({
	runPipelineOrFailFast: (params: { cwd: string; planPath: string }) => mockRunPipelineOrFailFast(params),
}));
// -------------------------
// The report card and the ship tail both read a run directory no mocked
// pipeline ever wrote, and neither is what these cases are about.
const mockRenderResult = jest.fn<(params: { result: PipelineResult; cwd: string }) => Promise<string[]>>();

jest.mock('#src/cli/common/implementRun/finishImplementRun/renderResult/renderResult.ts', () => ({
	renderResult: (params: { result: PipelineResult; cwd: string }) => mockRenderResult(params),
}));
// -------------------------
const mockShipAfterImplement = jest.fn<(params: { cwd: string; result: PipelineResult }) => Promise<number>>();

jest.mock('#src/cli/common/implementRun/finishImplementRun/shipAfterImplement/shipAfterImplement.ts', () => ({
	shipAfterImplement: (params: { cwd: string; result: PipelineResult }) => mockShipAfterImplement(params),
}));
// -------------------------
// The report is saved under the run's folder, and the run here is a result no
// pipeline wrote to disk, so the save is doubled rather than refused.
jest.mock('#src/runState/finalReport/writeRunFinalReport.ts', () => ({
	writeRunFinalReport: () => Promise.resolve(),
}));
// -------------------------

/** The plan every recorded case points `--plan` at, and the address the record is written under. */
const workOrderName = 'lo-42-add-widgets';
const planName = `${workOrderName}/001-add-widgets`;
const planFolder = join('.lightsout', 'work-orders', workOrderName, 'plans', '001-add-widgets');

/** What the plan inside the plans directory says. */
const planBody = '# Plan: add widgets\n';

/** The plan file at the repo root — the loose input a `--plan` outside the plans directory names. */
const loosePlanBody = '# Plan: a note nobody filed under a ticket\n';

/** A run that passed, carrying the manifest status the command run's end mark is closed with. */
const passedResult = {
	ok: true,
	manifest: { runId: 'aaaaaaaa-1111-2222-3333-444444444444', status: RunStatus.Passed },
} as unknown as PipelineResult;

/**
 * A real consumer repo holding a real plan folder and a loose plan file at its
 * root, built in a real linked worktree cut from that repo.
 *
 * The workspace is a genuine linked worktree rather than a bare temp directory
 * because that is the shape the record's location is decided in: the plan
 * folder stays in the checkout the command was launched from, and every path
 * the run resolves has to arrive back at that primary checkout.
 */
const setupImplementRecord = ({ args }: { args: string[] }) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ plan: loosePlanBody });
	const workspace = join(mkdtempSync(join(tmpdir(), 'lightsout-workspace-')), 'tree');

	execSync(`git worktree add -q --detach "${workspace}"`, { cwd, stdio: 'ignore' });

	// The branch an isolated run builds on is the work order record's answer, so
	// the record for this plan's work order stands on disk before the command runs.
	seedWorkOrderRecord({
		cwd,
		name: workOrderName,
		plans: [{ id: '001-add-widgets', title: 'Add widgets', progress: 'ready', createdAt: '2026-01-01T00:00:00.000Z' }],
	});
	mkdirSync(join(cwd, planFolder), { recursive: true });
	writeFileSync(join(cwd, planFolder, 'plan.md'), planBody);

	mockFetchDefaultBranch.mockResolvedValue('main');
	mockReadBranchWorktree.mockResolvedValue(undefined);
	mockCreateWorktree.mockResolvedValue(workspace);
	mockRequireImplementLifecycle.mockResolvedValue(undefined);
	mockRunPipelineOrFailFast.mockResolvedValue(passedResult);
	mockRenderResult.mockResolvedValue([]);
	mockShipAfterImplement.mockResolvedValue(0);

	return {
		context: { flags: parseFlags({ args }), rest: [], cwd },
		cwd,
		workspace,
		planDir: join(cwd, planFolder),
		...captured,
	};
};

/** Every activity record under a directory, however deep — how a case states that none was written. */
const activityRecordsUnder = ({ dir }: { dir: string }) =>
	readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((entry) => entry.endsWith('activity.jsonl'));

/** The folded record the plan folder holds, as a report reader would see it. */
const recordedTree = async ({ planDir }: { planDir: string }) => buildActivityTree({ plan: planName, marks: await readActivityMarks({ dir: planDir }) });

describe('implementCommand activity record', () => {
	test('an implement run records a command run labelled implement under the plan level', async () => {
		const { context, planDir } = setupImplementRecord({ args: ['--plan', join(planFolder, 'plan.md')] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		const report = await recordedTree({ planDir });

		// one plan level named for the plan, holding this invocation and nothing
		// else — and its end mark carries the status the pipeline's own manifest
		// reported, so a report and the exit code can never disagree
		expect(report.roots).toEqual([
			expect.objectContaining({
				level: 'plan',
				label: planName,
				startedAt: expect.any(String),
				endedAt: expect.any(String),
				children: [
					expect.objectContaining({
						level: 'command-run',
						label: 'implement',
						startedAt: expect.any(String),
						endedAt: expect.any(String),
						outcome: 'passed',
					}),
				],
			}),
		]);
	});

	test('a plan path outside the plans directory records nothing at all', async () => {
		const { context, cwd, workspace } = setupImplementRecord({ args: ['--plan', 'plan.md'] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		// A loose file is nobody's plan folder, so there is nowhere a record
		// belongs — and no work order's record says which branch to isolate it on,
		// which is what stops the run before one could be written.
		expect(activityRecordsUnder({ dir: cwd })).toStrictEqual([]);
		expect(activityRecordsUnder({ dir: workspace })).toStrictEqual([]);
		expect(mockRunPipelineOrFailFast).not.toHaveBeenCalled();
	});

	test('a run built in a worktree records under the primary checkout', async () => {
		const { context, cwd, workspace, planDir } = setupImplementRecord({ args: ['--plan', join(planFolder, 'plan.md')] });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		const report = await recordedTree({ planDir });

		// the tree comes down when the work ships, so a record written inside it
		// would take the whole account of the run with it
		expect(activityRecordsUnder({ dir: cwd })).toStrictEqual([join(planFolder, 'activity.jsonl')]);
		expect(activityRecordsUnder({ dir: workspace })).toStrictEqual([]);
		expect(report.roots).toEqual([expect.objectContaining({ level: 'plan', label: planName, children: [expect.objectContaining({ level: 'command-run' })] })]);
	});
});
