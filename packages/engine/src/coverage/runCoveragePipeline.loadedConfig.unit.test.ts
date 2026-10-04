import { describe, expect, jest, test } from '@jest/globals';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { CoverageWorklist } from '#src/contracts/coverage/CoverageWorklist.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { runCoveragePipeline } from '#src/coverage/runCoveragePipeline.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { createUncalledDriver } from '#tests/helpers/createUncalledDriver.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

// Mocked Imports
// -------------------------
// What the run initializer records has its own tests. What this file owns is
// that the pipeline hands it the config as read, not the stamped one; the
// initializer rejects so the pipeline stops before any gate or batch.
interface InitializeParams {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	loadedConfig: LoadedConfig;
	allowDirty?: boolean;
	existing?: RunManifest;
}

const mockInitializeCoverageRun = jest.fn<(params: InitializeParams) => Promise<{ manifest: RunManifest; worklist: CoverageWorklist }>>();

jest.mock('#src/coverage/initializeCoverageRun.ts', () => ({
	initializeCoverageRun: (params: InitializeParams) => mockInitializeCoverageRun(params),
}));
// -------------------------

const gates: LightsoutConfig['gates'] = { check: 'true', test: 'true', 'test-coverage': 'true' };

const setupPipeline = async () => {
	mockInitializeCoverageRun.mockRejectedValue(new Error('stopped after the run initializer'));

	const cwd = await freshCwd();
	const driver = createUncalledDriver({ reason: 'no batch runs once the initializer stops the pipeline' });
	const config: LightsoutConfig = { harness: 'codex', model: 'stamped-model', gates };
	const loadedConfig: LoadedConfig = { config: { harness: 'claude-code', gates }, path: '/repo/lightsout.config.json' };

	return { cwd, driver, config, loadedConfig };
};

describe('runCoveragePipeline', () => {
	test('the coverage pipeline hands its loaded config to the run initializer', async () => {
		const { cwd, driver, config, loadedConfig } = await setupPipeline();

		await getRejectionError({ promise: runCoveragePipeline({ cwd, driver, config, loadedConfig }) });

		expect(mockInitializeCoverageRun).toHaveBeenCalledWith(
			expect.objectContaining({
				config: { harness: 'codex', model: 'stamped-model', gates: { check: 'true', test: 'true', 'test-coverage': 'true' } },
				loadedConfig: {
					config: { harness: 'claude-code', gates: { check: 'true', test: 'true', 'test-coverage': 'true' } },
					path: '/repo/lightsout.config.json',
				},
			}),
		);
	});
});
