import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import { runDirectWork } from '#src/direct/runDirectWork/runDirectWork.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';
import type { AgentOutcome } from '#src/invoke/common/types/AgentOutcome.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The harness and the repo's gates are the two things a direct run drives, and
// each is another module's entry point with its own tests. Run state on disk is
// real, because the manifest a fresh run records is what these cases read.
const mockInvokeAgentWithContract =
	jest.fn<(params: { invocation: { prompt: string; systemPrompt: string }; allowedCommands?: string[] }) => Promise<AgentOutcome<WorkReport>>>();

jest.mock('#src/invoke/invokeAgentWithContract.ts', () => ({
	invokeAgentWithContract: (params: { invocation: { prompt: string; systemPrompt: string }; allowedCommands?: string[] }) =>
		mockInvokeAgentWithContract(params),
}));
// -------------------------
const mockRunGates = jest.fn<(params: { step?: string; onProgress?: (message: string) => void }) => Promise<GateRunResult>>();

jest.mock('#src/gates/runGates.ts', () => ({
	runGates: (params: { step?: string; onProgress?: (message: string) => void }) => mockRunGates(params),
}));
// -------------------------

const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };

/**
 * A consumer repo with the harness and the gates stubbed green, and two
 * configs that differ in harness, model and effort: the one the run was
 * stamped with, and the one read from the launching checkout's file.
 */
const setupLoadedConfigDirectRun = () => {
	const cwd = setupConsumerRepo();
	const gates = { check: 'true', test: 'true', 'test-coverage': false } as const;
	const config: LightsoutConfig = { gates, harness: 'claude-code', model: 'stamped-model', effort: 'max' };
	const loadedConfig: LoadedConfig = {
		config: { gates, harness: 'codex', model: 'file-model', effort: 'low' },
		path: join(cwd, 'lightsout.config.json'),
	};

	mockInvokeAgentWithContract.mockResolvedValue({
		ok: true,
		report: { status: WorkReportStatus.Complete, changedFiles: [{ path: 'src/thing.ts', summary: 'built it' }], summary: 'built it', failures: [] },
	});
	mockRunGates.mockResolvedValue({ error: undefined, failedFamilies: [], crashes: [], timeouts: [], coordination: undefined });

	const run = () =>
		runDirectWork({
			cwd,
			ticketBody: '# Drain the backlog\n\nBuild the thing.',
			ticketRef: 'LO-70',
			driver,
			driverName: 'claude-code',
			config,
			loadedConfig,
		});

	return { cwd, loadedConfig, run };
};

describe('runDirectWork', () => {
	test('a fresh direct run records the loaded config and its path', async () => {
		const { cwd, loadedConfig, run } = setupLoadedConfigDirectRun();

		const result = await run();
		const onDisk = await readRunManifest({ cwd, runId: result.manifest.runId });

		expect({
			returned: { config: result.manifest.config, configPath: result.manifest.configPath },
			onDisk: { config: onDisk.config, configPath: onDisk.configPath },
		}).toStrictEqual({
			returned: {
				config: { gates: { check: 'true', test: 'true', 'test-coverage': false }, harness: 'codex', model: 'file-model', effort: 'low' },
				configPath: loadedConfig.path,
			},
			onDisk: {
				config: { gates: { check: 'true', test: 'true', 'test-coverage': false }, harness: 'codex', model: 'file-model', effort: 'low' },
				configPath: loadedConfig.path,
			},
		});
	});
});
