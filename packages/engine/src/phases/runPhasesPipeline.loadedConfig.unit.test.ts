import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import { readRunConfig } from '#src/common/config/readRunConfig.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { Effort } from '#src/contracts/Effort.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';
import { createPhaseDriver } from '#tests/helpers/createPhaseDriver.ts';
import { readPhaseChildRuns } from '#tests/helpers/readPhaseChildRuns.ts';
import { runInRepo } from '#tests/helpers/runInRepo.ts';
import { setupPhasedRepo } from '#tests/helpers/setupPhasedRepo.ts';

/** What a command stamps over the config as read: a harness, model and effort the file never set. */
const stamp = ({ config }: { config: LightsoutConfig }): LightsoutConfig => ({ ...config, harness: 'codex', model: 'stamped-model', effort: Effort.Max });

/**
 * A fresh two-phase sequence: the config as read from the repo's
 * lightsout.config.json with that file's absolute path, and a stamped config
 * that differs from it, so a manifest recording the stamped one shows.
 */
const setupFreshSequence = async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const configPath = join(dir, 'lightsout.config.json');
	const config = await readConfig({ cwd: dir });
	const loadedConfig: LoadedConfig = { config, path: configPath };
	// as a manifest read back from disk holds it: JSON keeps no key whose value is undefined
	const recorded: unknown = JSON.parse(JSON.stringify(config));

	return { dir, overviewPath, configPath, loadedConfig, stamped: stamp({ config }), recorded };
};

/**
 * A sequence whose phase 1 passed and whose phase 2 never started: the
 * coordinator stopped after recording phase 1, so the phase-2 step names no run
 * of its own. Since then lightsout.config.json was rewritten with a gate
 * command the sequence never started with, and the rewrite committed, because
 * a phase starting for the first time refuses a tree holding uncommitted
 * edits. The resume hands on the config the coordinator recorded, as `resume`
 * does, with a stamped config over it.
 */
const setupResumedSequence = async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const configPath = join(dir, 'lightsout.config.json');
	const config = await readConfig({ cwd: dir });
	const recorded: unknown = JSON.parse(JSON.stringify(config));
	const parked = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [], parkAt: 2 }),
		config,
		loadedConfig: { config, path: configPath },
		overviewPath,
		skipRefactor: true,
	});
	const abandonedRunId = PhaseReport.parse(parked.manifest.steps[1]?.report).runId;
	const existing = await writeRunManifest({
		cwd: dir,
		manifest: {
			...parked.manifest,
			status: RunStatus.Running,
			currentStep: null,
			steps: parked.manifest.steps.map((step, index) => (index === 1 ? { id: step.id, status: RunStatus.Pending, attempts: 0 } : step)),
		},
	});
	const original: { gates: Record<string, unknown> } = JSON.parse(readFileSync(configPath, 'utf8'));

	writeFileSync(configPath, JSON.stringify({ ...original, gates: { ...original.gates, check: 'true # edited after the sequence began' } }));
	runInRepo({ cwd: dir, command: 'git', args: ['commit', '-qm', 'edit the config', '--', 'lightsout.config.json'] });

	const coordinator = await readRunManifest({ cwd: dir, runId: existing.runId });
	const answered = readRunConfig({ manifest: coordinator });

	if ('error' in answered) {
		throw new Error(answered.error);
	}

	const loadedConfig: LoadedConfig = { config: answered.config, path: coordinator.configPath };

	return { dir, configPath, existing, abandonedRunId, loadedConfig, stamped: stamp({ config: answered.config }), recorded };
};

describe('runPhasesPipeline', () => {
	test("the coordinator and every phase child record the coordinator's loaded config", async () => {
		const { dir, overviewPath, configPath, loadedConfig, stamped, recorded } = await setupFreshSequence();

		const result = await runPhasesPipeline({
			cwd: dir,
			driver: createPhaseDriver({ dir, seen: [] }),
			config: stamped,
			loadedConfig,
			overviewPath,
			skipRefactor: true,
		});

		const coordinator = await readRunManifest({ cwd: dir, runId: result.manifest.runId });
		const children = await readPhaseChildRuns({ cwd: dir, manifest: coordinator });

		// the error rides along so a failure says why, rather than only that it failed
		expect({
			ok: result.ok,
			error: result.error,
			records: [coordinator, ...children].map((manifest) => ({ config: manifest.config, configPath: manifest.configPath })),
		}).toStrictEqual({
			ok: true,
			error: undefined,
			records: [
				{ config: recorded, configPath },
				{ config: recorded, configPath },
				{ config: recorded, configPath },
			],
		});
	});

	test('a resumed sequence creates an unstarted phase with the recorded config, not the edited file', async () => {
		const { dir, configPath, existing, abandonedRunId, loadedConfig, stamped, recorded } = await setupResumedSequence();

		const resumed = await runPhasesPipeline({
			cwd: dir,
			driver: createPhaseDriver({ dir, seen: [] }),
			config: stamped,
			loadedConfig,
			existing,
			skipRefactor: true,
		});

		const [, second] = await readPhaseChildRuns({ cwd: dir, manifest: resumed.manifest });

		// phase 2 got a run of its own on this resume, and it records the sequence's config, not the rewritten file
		expect({
			ok: resumed.ok,
			error: resumed.error,
			newChild: second !== undefined && second.runId !== abandonedRunId,
			config: second?.config,
			configPath: second?.configPath,
		}).toStrictEqual({ ok: true, error: undefined, newChild: true, config: recorded, configPath });
	});
});
