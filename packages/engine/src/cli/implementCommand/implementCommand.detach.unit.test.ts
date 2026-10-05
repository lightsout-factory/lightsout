import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { implementCommand } from '#src/cli/implementCommand/implementCommand.ts';
import { parseFlags } from '#src/cli/parseFlags.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { ShipResult } from '#src/contracts/ship/ShipResult.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { expectDefined } from '#tests/helpers/expectDefined.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { manifestOf } from '#tests/helpers/setupResume.ts';

// Mocked Imports
// -------------------------
// The detached launch spawns a real engine and waits on it; what this file pins
// is only what the command hands it and what it does with the code it answers.
interface LaunchParams {
	cwd: string;
	command: string;
	args: string[];
	runId: string;
	relayMailbox?: string;
	pollMs?: number;
}

const mockLaunchDetached = jest.fn<(params: LaunchParams) => Promise<number>>();

jest.mock('#src/cli/common/detach/launchDetached.ts', () => ({
	launchDetached: (params: LaunchParams) => mockLaunchDetached(params),
}));
// -------------------------
// The config read stays real; the spy is what lets the launch row prove the
// parent never reached it.
const { readConfig: actualReadConfig } = jest.requireActual<typeof import('#src/common/config/readConfig.ts')>('#src/common/config/readConfig.ts');

const mockReadConfig = jest.fn<(params: { cwd: string }) => Promise<LightsoutConfig>>();

jest.mock('#src/common/config/readConfig.ts', () => ({
	readConfig: (params: { cwd: string }) => mockReadConfig(params),
}));
// -------------------------
// The pipeline is scripted: the launch rows prove it never starts, and the child
// row reads the id and the environment it starts with.
type PipelineParams = Parameters<typeof import('#src/cli/common/runPipelineOrFailFast.ts').runPipelineOrFailFast>[0];

const mockRunPipelineOrFailFast = jest.fn<(params: PipelineParams) => Promise<PipelineResult>>();

jest.mock('#src/cli/common/runPipelineOrFailFast.ts', () => ({
	runPipelineOrFailFast: (params: PipelineParams) => mockRunPipelineOrFailFast(params),
}));
// -------------------------
// The tracker write and the merge are the steps that would leave the machine.
const mockRequireImplementLifecycle = jest.fn<(params: { cwd: string }) => Promise<string | undefined>>();

jest.mock('#src/ticketLifecycle/requireImplementLifecycle.ts', () => ({
	requireImplementLifecycle: (params: { cwd: string }) => mockRequireImplementLifecycle(params),
}));

const mockRunShip = jest.fn<(params: { cwd: string }) => Promise<ShipResult>>();

jest.mock('#src/ship/runShip/runShip.ts', () => ({ runShip: (params: { cwd: string }) => mockRunShip(params) }));
// -------------------------
// The report card reads a run directory a scripted pipeline never filled in.
const mockRenderResult = jest.fn<(params: { result: PipelineResult; cwd: string }) => Promise<string[]>>();

jest.mock('#src/cli/common/implementRun/finishImplementRun/renderResult/renderResult.ts', () => ({
	renderResult: (params: { result: PipelineResult; cwd: string }) => mockRenderResult(params),
}));
// -------------------------

/** A run id spelled the way `randomUUID` mints one. */
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The id a detached parent minted and printed before its child started. */
const launchedRunId = '5f0c2e1a-7b3d-4c8e-9a61-2d4f8b0c9e17';

/** The ticket folder the child's plan lives in. */
const workOrderName = 'lo-7-search';
const workOrderFolder = join('.lightsout', 'work-orders', workOrderName);
const planId = '001-basics';
const planPath = join(workOrderFolder, 'plans', planId, 'plan.md');

const recordOf = (): WorkOrderState => ({
	schemaVersion: 1,
	name: workOrderName,
	ticketRef: 'LO-7',
	branch: workOrderName,
	mode: WorkOrderMode.SinglePlan,
	plans: [{ id: planId, title: `Plan ${planId}`, progress: PlanProgress.Ready, createdAt: '2026-03-01T00:00:00.000Z' }],
	history: [],
});

const readRecord = ({ cwd }: { cwd: string }): WorkOrderState => JSON.parse(readFileSync(join(cwd, workOrderFolder, 'state.json'), 'utf8')) as WorkOrderState;

/**
 * The command as a user types it with `--detach`: `rest` is exactly what was
 * typed after `implement`, and the parsed flags come from the same words. The
 * pipeline is armed to fail loudly, because reaching it at all is the defect.
 */
const setupDetachLaunch = ({ args }: { args: string[] }) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo();

	mockLaunchDetached.mockResolvedValue(7);
	mockReadConfig.mockImplementation(actualReadConfig);
	mockRunPipelineOrFailFast.mockImplementation(() => {
		throw new Error('the parent of a detached launch ran the pipeline itself');
	});

	return { context: { flags: parseFlags({ args }), rest: args, cwd }, args, cwd, ...captured };
};

/**
 * The detached child: a real consumer repo holding one ticket's record and its
 * plan, started with the id its parent minted in its environment. The pipeline
 * writes the manifest a real run would, under whatever id it is handed, and
 * notes what the launch variable read when it started.
 */
const setupDetachedChild = () => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo();
	const envAtPipelineStart: (string | undefined)[] = [];

	mkdirSync(dirname(join(cwd, planPath)), { recursive: true });
	writeFileSync(join(cwd, planPath), '# Plan: the basics\n');
	writeFileSync(join(cwd, workOrderFolder, 'state.json'), `${JSON.stringify(recordOf(), undefined, '\t')}\n`);

	mockReadConfig.mockImplementation(actualReadConfig);
	mockRequireImplementLifecycle.mockResolvedValue(undefined);
	mockRenderResult.mockResolvedValue([]);
	mockRunPipelineOrFailFast.mockImplementation(async ({ cwd: runCwd, runId }) => {
		envAtPipelineStart.push(process.env.LIGHTSOUT_RUN_ID);

		if (runId === undefined) {
			throw new Error('the pipeline was started with no pre-minted run id, so no manifest could carry the id the parent printed');
		}

		const manifest = manifestOf({ runId, plan: planPath, status: RunStatus.Passed });
		const runDir = runDirFor({ cwd: runCwd, runId, workOrderName });

		mkdirSync(runDir, { recursive: true });
		writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify(manifest)}\n`);

		return { ok: true, manifest };
	});

	// The Jest environment hands each test file its own copy of the process
	// environment, so this cannot reach another file even if the command fails
	// to remove it.
	process.env.LIGHTSOUT_RUN_ID = launchedRunId;

	const args = ['--plan', planPath, '--no-worktree'];

	return { context: { flags: parseFlags({ args }), rest: args, cwd }, cwd, envAtPipelineStart, ...captured };
};

describe('implementCommand --detach', () => {
	test.each([
		{ detach: ['--detach'], launched: true, expectedExitCodes: [7], usagePrinted: false },
		{ detach: ['--detach', 'now'], launched: false, expectedExitCodes: [1], usagePrinted: true },
	])(
		'implementCommand: --detach hands the typed command to a detached launch under a freshly minted run id and exits with its code',
		async ({ detach, launched, expectedExitCodes, usagePrinted }) => {
			const { context, args, cwd, errors, exitCodes } = setupDetachLaunch({ args: ['--plan', 'plans/demo/plan.md', '--skip-refactor', ...detach] });

			await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

			// the parent reads no config and runs no pipeline: every refusal is the
			// child's to make, so it lands in the launch log and is relayed
			expect({
				launches: mockLaunchDetached.mock.calls.map(([params]) => params),
				configReads: mockReadConfig.mock.calls.length,
				pipelineRuns: mockRunPipelineOrFailFast.mock.calls.length,
				usagePrinted: errors.some((line) => /^lightsout — deterministic engine for coding agents/.test(line)),
				exitCodes,
			}).toEqual({
				launches: launched ? [{ cwd, command: 'implement', args, runId: expect.stringMatching(uuidPattern) }] : [],
				configReads: 0,
				pipelineRuns: 0,
				usagePrinted,
				exitCodes: expectedExitCodes,
			});
		},
	);

	test('implementCommand: a detached child builds under the id its parent printed and strips it from its environment first', async () => {
		const { context, cwd, envAtPipelineStart, exitCodes } = setupDetachedChild();

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		const [plan] = readRecord({ cwd }).plans;
		expectDefined(plan);
		// the pipeline and the ticket record both carry the id the parent printed,
		// and nothing the pipeline spawns could have inherited the variable
		expect({
			pipelineRunIds: mockRunPipelineOrFailFast.mock.calls.map(([params]) => params.runId),
			recordedRunId: plan.implementation?.runId,
			envAtPipelineStart,
			envAfter: process.env.LIGHTSOUT_RUN_ID,
			launches: mockLaunchDetached.mock.calls.length,
			exitCodes,
		}).toStrictEqual({
			pipelineRunIds: [launchedRunId],
			recordedRunId: launchedRunId,
			envAtPipelineStart: [undefined],
			envAfter: undefined,
			launches: 0,
			exitCodes: [0],
		});
	});
});
