import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { runPlanFolderPipeline } from '#src/queue/workers/buildWorkOrderPlans/runPlanFolderPipeline.ts';
import { planWorkspaceFolder } from '#tests/helpers/planWorkspaceFolder.ts';

/** What either pipeline is handed: the stamped config and, beside it, the config as read with the file it came from. */
interface PipelineCall {
	cwd: string;
	config: LightsoutConfig;
	loadedConfig: LoadedConfig;
	driver: Driver;
	planPath?: string;
	overviewPath?: string;
	runId?: string;
	queueRunId?: string;
	onProgress?: (message: string) => void;
}

// Mocked Imports
// -------------------------
// Both pipelines record the run they create, and each is covered by its own
// tests. What this file owns is that the queue's loaded config reaches
// whichever one the plan folder's shape selects, unchanged.
const mockRunPhasesPipeline = jest.fn<(params: PipelineCall) => Promise<PipelineResult>>();

jest.mock('#src/phases/runPhasesPipeline/runPhasesPipeline.ts', () => ({ runPhasesPipeline: (params: PipelineCall) => mockRunPhasesPipeline(params) }));
// -------------------------
const mockRunImplementPipeline = jest.fn<(params: PipelineCall) => Promise<PipelineResult>>();

jest.mock('#src/pipeline/runImplementPipeline/runImplementPipeline.ts', () => ({
	runImplementPipeline: (params: PipelineCall) => mockRunImplementPipeline(params),
}));
// -------------------------

const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };

const passedManifest: RunManifest = {
	runId: 'run-7',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:01.000Z',
	plan: '.lightsout/work-orders/lo-188-read-config-once/plans/plan.md',
	harness: 'claude-code',
	status: RunStatus.Passed,
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
};

/**
 * A real worktree on disk holding one plan folder, since the phased check reads
 * the tree rather than being told. `phased` adds the overview file that makes it
 * one. The stamped config carries the implement harness and the loaded config
 * the file's own, so a pipeline handed the stamped one in its place reads apart.
 */
const setupPlanFolder = ({ phased }: { phased: boolean }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-plan-folder-loaded-config-'));
	const name = 'lo-188-read-config-once';
	const folder = planWorkspaceFolder({ cwd, name });

	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, 'plan.md'), '# Plan\n');

	if (phased) {
		writeFileSync(join(folder, 'overview.md'), '# Overview\n');
	}

	mockRunPhasesPipeline.mockResolvedValue({ ok: true, manifest: passedManifest });
	mockRunImplementPipeline.mockResolvedValue({ ok: true, manifest: passedManifest });

	const config: LightsoutConfig = { harness: 'claude-code', model: 'opus', gates: { check: 'true', test: 'true', 'test-coverage': false } };
	const loadedConfig: LoadedConfig = {
		config: { harness: 'codex', gates: { check: 'pnpm check', test: 'true', 'test-coverage': false } },
		path: '/launching/checkout/lightsout.config.json',
	};

	return { cwd, name, config, loadedConfig };
};

describe('runPlanFolderPipeline', () => {
	test.each([
		{ phased: false, ran: 'implement' },
		{ phased: true, ran: 'phases' },
	])('a single-plan and a phased plan folder both run with the loaded config', async ({ phased, ran }) => {
		const { cwd, name, config, loadedConfig } = setupPlanFolder({ phased });

		const outcome = await runPlanFolderPipeline({ cwd, name, config, loadedConfig, driver, queueRunId: 'queue-run' });

		const handed = {
			implement: mockRunImplementPipeline.mock.calls.map(([call]) => ({ config: call.config, loadedConfig: call.loadedConfig })),
			phases: mockRunPhasesPipeline.mock.calls.map(([call]) => ({ config: call.config, loadedConfig: call.loadedConfig })),
		};

		// the pipeline the folder's shape selects records the config as read and
		// its path, while the stamped config still rides beside it for the run
		expect({ outcome, handed }).toStrictEqual({
			outcome: {},
			handed: {
				implement: ran === 'implement' ? [{ config, loadedConfig }] : [],
				phases: ran === 'phases' ? [{ config, loadedConfig }] : [],
			},
		});
	});
});
