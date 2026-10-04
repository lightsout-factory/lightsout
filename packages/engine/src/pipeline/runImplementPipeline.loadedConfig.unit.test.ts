import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { Effort } from '#src/contracts/Effort.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Every agent turn is rate-limited, so a run parks at its first agent step:
// the manifest is born and written, and nothing past it matters here.
const parkingDriver: Driver = { name: 'stub', invoke: async () => ({ text: '', exitCode: 1, rateLimited: true }) };

/**
 * A repo whose lightsout.config.json sets its own harness, model and effort,
 * read once as the loaded config, beside a stamped config that writes other
 * values over all three, as a command's harness resolution does.
 */
const setupLoadedConfig = async () => {
	const dir = setupConsumerRepo({ config: { harness: 'claude-code', model: 'file-model', effort: Effort.Low } });
	const loaded = await readConfig({ cwd: dir });
	const loadedConfig = { config: loaded, path: join(dir, 'lightsout.config.json') };
	const config = { ...loaded, harness: 'codex', model: 'stamped-model', effort: Effort.Max };

	return { dir, loaded, loadedConfig, config };
};

/** A run already parked with the startup config recorded, and a different loaded config a resume is handed. */
const setupParkedRun = async () => {
	const { dir, loaded, loadedConfig, config } = await setupLoadedConfig();
	const parked = await runImplementPipeline({ cwd: dir, driver: parkingDriver, config, loadedConfig, planPath: 'plan.md' });
	const existing = await readRunManifest({ cwd: dir, runId: parked.manifest.runId });
	const otherLoadedConfig = {
		config: { ...loaded, model: 'edited-model', gates: { ...loaded.gates, check: 'false' } },
		path: join(dir, 'elsewhere', 'lightsout.config.json'),
	};

	return { dir, loaded, config, existing, otherLoadedConfig };
};

describe('runImplementPipeline', () => {
	test('a fresh run records the loaded config rather than the stamped one', async () => {
		const { dir, loaded, loadedConfig, config } = await setupLoadedConfig();

		const result = await runImplementPipeline({ cwd: dir, driver: parkingDriver, config, loadedConfig, planPath: 'plan.md' });
		const recorded = await readRunManifest({ cwd: dir, runId: result.manifest.runId });

		expect({ config: recorded.config, configPath: recorded.configPath }).toStrictEqual({ config: loaded, configPath: join(dir, 'lightsout.config.json') });
	});

	test('a resumed run keeps the config its manifest already recorded', async () => {
		const { dir, loaded, existing, otherLoadedConfig, config } = await setupParkedRun();

		const result = await runImplementPipeline({ cwd: dir, driver: parkingDriver, config, loadedConfig: otherLoadedConfig, existing });
		const recorded = await readRunManifest({ cwd: dir, runId: result.manifest.runId });

		expect({ runId: recorded.runId, config: recorded.config, configPath: recorded.configPath }).toStrictEqual({
			runId: existing.runId,
			config: loaded,
			configPath: join(dir, 'lightsout.config.json'),
		});
	});
});
