import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { RunOwner } from '#src/contracts/run/RunOwner.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { runPlanFolderPipeline } from '#src/queue/workers/internal/runPlanFolderPipeline.ts';
import { createRun } from '#src/runState/createRun.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { planWorkspaceFolder } from '#tests/helpers/planWorkspaceFolder.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';

/** What either pipeline is handed: the two the folder's shape chooses between differ only in which path they carry. */
interface PipelineCall {
	cwd: string;
	config: LightsoutConfig;
	driver: Driver;
	planPath?: string;
	overviewPath?: string;
	runId?: string;
	queueRunId?: string;
	onProgress?: (message: string) => void;
}

// Mocked Imports
// -------------------------
// Both pipelines spawn a harness against a real repository, and each is covered
// by its own tests. What this file owns is which of the two a plan folder's
// shape selects, the path it is pointed at, and how its result is stated in the
// queue's own terms — all observable with them stubbed.
const mockRunPhasesPipeline = jest.fn<(params: PipelineCall) => Promise<PipelineResult>>();

jest.mock('#src/phases/runPhasesPipeline.ts', () => ({ runPhasesPipeline: (params: PipelineCall) => mockRunPhasesPipeline(params) }));
// -------------------------
const mockRunImplementPipeline = jest.fn<(params: PipelineCall) => Promise<PipelineResult>>();

jest.mock('#src/pipeline/runImplementPipeline.ts', () => ({ runImplementPipeline: (params: PipelineCall) => mockRunImplementPipeline(params) }));
// -------------------------

const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };
const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };

const manifestOf = (status: RunStatus): RunManifest => ({
	runId: 'run-7',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:01.000Z',
	plan: '.lightsout/work-orders/lo-75-queue-owns-the-build/plans/plan.md',
	harness: 'claude-code',
	status,
	currentStep: null,
	steps: [],
	changedFiles: [],
	commits: [],
	packages: [],
	baselineDirtyFiles: [],
	testSubjects: [],
	acceptanceTests: [],
	approvedTests: [],
	unreachableChangedFiles: [],
	coverageExcludedChangedFiles: [],
});

/**
 * A real worktree on disk holding one plan folder, since the phased check reads
 * the tree rather than being told. `phased` adds the overview file that makes it
 * one; `result` is what whichever pipeline runs reports back.
 */
const setupPlanFolder = ({
	phased = false,
	result = { ok: true, manifest: manifestOf(RunStatus.Passed) },
}: {
	phased?: boolean;
	result?: PipelineResult;
} = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-plan-folder-'));
	const name = 'lo-75-queue-owns-the-build';
	const folder = planWorkspaceFolder({ cwd: cwd, name: name });

	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, 'plan.md'), '# Plan\n');

	if (phased) {
		writeFileSync(join(folder, 'overview.md'), '# Overview\n');
	}

	mockRunPhasesPipeline.mockResolvedValue(result);
	mockRunImplementPipeline.mockResolvedValue(result);

	const onProgress = jest.fn<(message: string) => void>();

	return { cwd, name, folder, onProgress };
};

/** The ticket folder's name, which is also the branch every plan below implements on. */
const workOrderName = 'lo-140-multiple-plans';
const firstPlan = '001-queue-build';
const secondPlan = '002-open-outcome';

const planOf = ({ id, progress }: { id: string; progress: PlanProgress }): WorkOrderPlan => ({
	id,
	title: `plan ${id}`,
	progress,
	createdAt: '2026-01-01T00:00:00.000Z',
});

/** A passed run of the whole plan, which is the only shape that finishes a plan's implementation. */
const passedPlanManifest = ({ planId }: { planId: string }): RunManifest => ({
	...manifestOf(RunStatus.Passed),
	plan: join('.lightsout', 'work-orders', workOrderName, 'plans', planId, 'plan.md'),
});

/**
 * A real repository standing on the ticket branch, holding the work order's record
 * and one folder per plan — the three things the ticket lifecycle reads: the
 * record for the order the plans build in, `HEAD` for where an implementation
 * starts, and each plan's own files for the snapshot a pass records.
 */
const setupTicketPlanFolder = ({ plans, result }: { plans: WorkOrderPlan[]; result: PipelineResult }) => {
	const { cwd } = setupBranchRepo({ branch: workOrderName });
	const workOrderFolder = join(cwd, '.lightsout', 'work-orders', workOrderName);
	const record: WorkOrderState = {
		schemaVersion: 1,
		name: workOrderName,
		ticketRef: 'LO-140',
		branch: workOrderName,
		mode: WorkOrderMode.MultiplePlan,
		plans,
		history: [{ at: '2026-01-01T00:00:00.000Z', kind: WorkOrderEventKind.PlanAdded, detail: `added plan ${firstPlan}` }],
	};

	mkdirSync(workOrderFolder, { recursive: true });

	for (const plan of plans) {
		mkdirSync(join(workOrderFolder, 'plans', plan.id), { recursive: true });
		writeFileSync(join(workOrderFolder, 'plans', plan.id, 'plan.md'), `# ${plan.id}\n`);
	}

	writeFileSync(join(workOrderFolder, 'state.json'), JSON.stringify(record));
	mockRunPhasesPipeline.mockResolvedValue(result);
	mockRunImplementPipeline.mockResolvedValue(result);

	const onProgress = jest.fn<(message: string) => void>();

	return { cwd, workOrderFolder, onProgress };
};

/** One plan's entry in the work order's record as it stands on disk once the call has returned. */
const planAt = ({ workOrderFolder, id }: { workOrderFolder: string; id: string }) =>
	(JSON.parse(readFileSync(join(workOrderFolder, 'state.json'), 'utf8')) as WorkOrderState).plans.find((plan) => plan.id === id);

/**
 * A plan folder whose pipeline stands in for the real one up to its first agent
 * invocation: it creates its run under the id it was handed, carrying the queue
 * run id it was handed, the way either pipeline's own run creation does, then
 * reads the owner record from inside the build — where the agent would be
 * working — before passing, or throwing when `throws` is set.
 */
const setupOwnedBuild = ({ phased = false, throws = false }: { phased?: boolean; throws?: boolean } = {}) => {
	const { cwd, name, folder, onProgress } = setupPlanFolder({ phased });
	const seen: { runId?: string; owner?: RunOwner } = {};
	const build = async ({ runId, overviewPath, queueRunId }: PipelineCall): Promise<PipelineResult> => {
		const manifest = await createRun({
			cwd,
			runId,
			plan: join(folder, 'plan.md'),
			overview: overviewPath,
			pipeline: phased ? PipelineKind.Phases : PipelineKind.Implement,
			driver: 'claude-code',
			loadedConfig: { config },
			queueRunId,
		});

		seen.runId = manifest.runId;
		seen.owner = await readRunOwner({ cwd, runId: manifest.runId });

		if (throws) {
			throw new Error('the harness crashed mid-build');
		}

		return { ok: true, manifest: { ...manifest, status: RunStatus.Passed } };
	};

	mockRunPhasesPipeline.mockImplementation(build);
	mockRunImplementPipeline.mockImplementation(build);

	return { cwd, name, onProgress, seen };
};

describe('runPlanFolderPipeline', () => {
	test('runs the phases pipeline against the overview a phased plan folder holds', async () => {
		const { cwd, name, folder, onProgress } = setupPlanFolder({ phased: true });

		const outcome = await runPlanFolderPipeline({ cwd, name, config, loadedConfig: { config }, driver, onProgress, queueRunId: 'queue-run' });

		expect(mockRunPhasesPipeline).toHaveBeenCalledWith(expect.objectContaining({ cwd, config, driver, overviewPath: join(folder, 'overview.md'), onProgress }));
		expect(mockRunImplementPipeline).not.toHaveBeenCalled();
		expect(outcome).toStrictEqual({});
	});

	test('runs the implement pipeline against the plan file when the folder is not phased', async () => {
		const { cwd, name, folder, onProgress } = setupPlanFolder();

		const outcome = await runPlanFolderPipeline({ cwd, name, config, loadedConfig: { config }, driver, onProgress, queueRunId: 'queue-run' });

		expect(mockRunImplementPipeline).toHaveBeenCalledWith(expect.objectContaining({ cwd, config, driver, planPath: join(folder, 'plan.md'), onProgress }));
		expect(mockRunPhasesPipeline).not.toHaveBeenCalled();
		expect(outcome).toStrictEqual({});
	});

	test('parks a failed build with the resume sentence naming the run it continues', async () => {
		const { cwd, name, onProgress } = setupPlanFolder({ result: { ok: false, error: 'the gates stayed red', manifest: manifestOf(RunStatus.Failed) } });

		const outcome = await runPlanFolderPipeline({ cwd, name, config, loadedConfig: { config }, driver, onProgress, queueRunId: 'queue-run' });

		// the worktree is left standing, so the sentence a human reads is the one
		// command that picks the run back up where it stopped
		expect(outcome).toEqual({ error: expect.stringMatching(/^the gates stayed red\b.*`lightsout resume --run run-7`/) });
	});

	test('names the state a pipeline ended in when it stopped without saying why', async () => {
		const { cwd, name, onProgress } = setupPlanFolder({ result: { ok: false, manifest: manifestOf(RunStatus.Escalated) } });

		const outcome = await runPlanFolderPipeline({ cwd, name, config, loadedConfig: { config }, driver, onProgress, queueRunId: 'queue-run' });

		// a run that stated no reason still has a state, and naming it beats an
		// empty error nobody can act on
		expect(outcome).toEqual({ error: expect.stringMatching(/^the run ended escalated\b.*`lightsout resume --run run-7`/) });
	});

	test('returns the ticket refusal as the worker error without building a blocked plan', async () => {
		const { cwd, workOrderFolder, onProgress } = setupTicketPlanFolder({
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready }), planOf({ id: secondPlan, progress: PlanProgress.Ready })],
			result: { ok: true, manifest: passedPlanManifest({ planId: secondPlan }) },
		});

		const outcome = await runPlanFolderPipeline({
			cwd,
			name: `${workOrderName}/${secondPlan}`,
			config,
			loadedConfig: { config },
			driver,
			onProgress,
			queueRunId: 'queue-run',
		});

		// a work order's plans implement in numeric order, so the plan standing in the
		// way is named and nothing is built or recorded for the one that is blocked
		expect(outcome).toEqual({ error: expect.stringContaining(firstPlan) });
		expect(outcome.error).toMatch(/implementation has not finished/);
		expect(mockRunImplementPipeline).not.toHaveBeenCalled();
		expect(mockRunPhasesPipeline).not.toHaveBeenCalled();
		expect(planAt({ workOrderFolder, id: secondPlan })?.progress).toBe('ready');
	});

	test('records a queued ticket plan implemented once its build passes', async () => {
		const { cwd, workOrderFolder, onProgress } = setupTicketPlanFolder({
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			result: { ok: true, manifest: passedPlanManifest({ planId: firstPlan }) },
		});

		const outcome = await runPlanFolderPipeline({
			cwd,
			name: `${workOrderName}/${firstPlan}`,
			config,
			loadedConfig: { config },
			driver,
			onProgress,
			queueRunId: 'queue-run',
		});

		expect(outcome).toStrictEqual({});
		expect(planAt({ workOrderFolder, id: firstPlan })).toEqual(
			expect.objectContaining({ progress: 'implemented', implementation: expect.objectContaining({ finishedAt: expect.any(String) }) }),
		);
	});

	test.each([{ phased: true }, { phased: false }])(
		'points whichever pipeline builds the plan folder at the queue run until the build settles',
		async ({ phased }) => {
			const { cwd, name, onProgress, seen } = setupOwnedBuild({ phased });

			const outcome = await runPlanFolderPipeline({ cwd, name, config, loadedConfig: { config }, driver, onProgress, queueRunId: 'q-1' });

			const ownerAfter = await readRunOwner({ cwd, runId: seen.runId ?? 'no-run-was-created' });

			// while the build works its run answers to the queue that is still alive;
			// once it has settled the run points at nothing, so it cannot read live
			// on the queue's behalf
			expect({ outcome, ownerDuring: seen.owner, ownerAfter }).toStrictEqual({
				outcome: {},
				ownerDuring: { queueRunId: 'q-1' },
				ownerAfter: undefined,
			});
		},
	);

	test('removes the owner record of a build that throws', async () => {
		const { cwd, name, onProgress, seen } = setupOwnedBuild({ throws: true });

		const error = await getRejectionError({
			promise: runPlanFolderPipeline({ cwd, name, config, loadedConfig: { config }, driver, onProgress, queueRunId: 'q-1' }),
		});

		const ownerAfter = await readRunOwner({ cwd, runId: seen.runId ?? 'no-run-was-created' });

		// the queue parks a worker that throws and keeps going, so the run it left
		// in running must not keep pointing at that live queue
		expect(error.message).toContain('the harness crashed mid-build');
		expect({ ownerDuring: seen.owner, ownerAfter }).toStrictEqual({ ownerDuring: { queueRunId: 'q-1' }, ownerAfter: undefined });
	});
});
