import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { runRefactorPipeline } from '#src/refactor/runRefactorPipeline.ts';
import { createRun } from '#src/runState/createRun.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The initializer builds the work-list by running the real standards checks —
// its own module, covered by its own tests. What the pipeline owns is which
// config it hands over, observable with the initializer stubbed.

interface InitializeRunParams {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	loadedConfig: LoadedConfig;
	path?: string;
	all?: boolean;
	allowDirty?: boolean;
	existing?: RunManifest;
}

const mockInitializeRun = jest.fn<(params: InitializeRunParams) => Promise<{ manifest: RunManifest; worklist: RefactorWorklist }>>();

jest.mock('#src/refactor/initializeRun.ts', () => ({
	initializeRun: (params: InitializeRunParams) => mockInitializeRun(params),
}));
// -------------------------

const driver: Driver = { name: 'stub', invoke: async () => ({ text: '', exitCode: 0 }) };

/**
 * A real refactor run with an empty work-list, so the pipeline ends at
 * "nothing to do" right after the initializer answers. The stamped config
 * carries the command's harness, model and effort; the loaded config is the
 * file as read, with different values for each, and its absolute path.
 */
const setupLoadedConfigRun = async () => {
	const cwd = setupConsumerRepo();
	const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': false };
	const stamped: LightsoutConfig = { harness: 'claude-code', model: 'stamped-model', effort: 'high', gates };
	const loadedConfig: LoadedConfig = {
		config: { harness: 'codex', model: 'file-model', effort: 'low', gates },
		path: join(cwd, 'lightsout.config.json'),
	};
	const manifest = await createRun({ cwd, plan: 'plan.md', pipeline: PipelineKind.Refactor, driver: driver.name });
	const worklist: RefactorWorklist = { at: '2026-01-01T00:00:00.000Z', path: '.', all: false, batches: [] };

	mockInitializeRun.mockResolvedValue({ manifest, worklist });

	return { cwd, stamped, loadedConfig };
};

describe('runRefactorPipeline', () => {
	test('the refactor pipeline hands its loaded config to the run initializer', async () => {
		const { cwd, stamped, loadedConfig } = await setupLoadedConfigRun();

		await runRefactorPipeline({ cwd, driver, config: stamped, loadedConfig });

		expect(mockInitializeRun).toHaveBeenCalledWith(expect.objectContaining({ config: stamped, loadedConfig }));
	});
});
