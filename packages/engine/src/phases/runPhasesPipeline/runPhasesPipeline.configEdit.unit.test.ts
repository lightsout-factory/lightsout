import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline/runPhasesPipeline.ts';
import { createPhaseDriver } from '#tests/helpers/createPhaseDriver.ts';
import { readPhaseChildRuns } from '#tests/helpers/readPhaseChildRuns.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupPhasedRepo } from '#tests/helpers/setupPhasedRepo.ts';

// LO-182 replayed end to end: phase 1's agent edits lightsout.config.json into
// a file this engine rejects, and every later step must keep the config the
// run started with rather than read the edited file.

/**
 * A two-phase sequence whose config is read once before the run, and whose
 * phase-1 implement agent also rewrites lightsout.config.json — the original
 * content plus a misspelled top-level key the strict schema rejects, and a
 * failing `gates.check`, so any later re-read of the file stops the run.
 */
const setupConfigEditingPhases = async () => {
	const { dir, overviewPath } = setupPhasedRepo({ phases: 2 });
	const configPath = join(dir, 'lightsout.config.json');
	const original: { gates: Record<string, unknown> } = JSON.parse(readFileSync(configPath, 'utf8'));
	const edited = JSON.stringify({ ...original, gates: { ...original.gates, check: 'exit 1' }, 'standards-pak': 'acme/house' });
	const config = await readConfig({ cwd: dir });
	const phaseDriver = createPhaseDriver({ dir, seen: [] });
	const driver: Driver = {
		name: phaseDriver.name,
		invoke: async (invocation) => {
			if (roleOf(invocation.prompt) === 'implement' && invocation.systemPrompt?.includes('PHASE-1-SENTINEL') === true) {
				writeFileSync(configPath, edited);
			}

			return phaseDriver.invoke(invocation);
		},
	};

	return { dir, overviewPath, configPath, config, driver };
};

test('a phase that adds a key the engine rejects to lightsout.config.json does not stop the later phases', async () => {
	const { dir, overviewPath, configPath, config, driver } = await setupConfigEditingPhases();
	const progress: string[] = [];

	const result = await runPhasesPipeline({
		cwd: dir,
		driver,
		config,
		loadedConfig: { config },
		overviewPath,
		onProgress: (message) => progress.push(message),
	});

	const children = await readPhaseChildRuns({ cwd: dir, manifest: result.manifest });
	const steps = [...result.manifest.steps, ...children.flatMap((child) => child.steps)];

	// the error rides along so a failure says why, rather than only that it failed
	expect({ ok: result.ok, error: result.error }).toStrictEqual({ ok: true, error: undefined });
	expect({
		// the edit really landed, so the run below ran against a rejected file on disk
		edited: readFileSync(configPath, 'utf8').includes('"standards-pak"'),
		sequence: result.manifest.status,
		children: children.map((child) => child.status),
		// phase 2's cleanup ran its standards work-list against the edited tree, and passed
		phase2Cleanup: children[1]?.steps.find((step) => step.id === 'refactor')?.status,
	}).toStrictEqual({ edited: true, sequence: 'passed', children: ['passed', 'passed'], phase2Cleanup: 'passed' });
	expect({
		stepErrors: steps.filter((step) => step.error?.includes('is not valid') === true).map((step) => step.error),
		progress: progress.filter((message) => message.includes('is not valid')),
	}).toStrictEqual({ stepErrors: [], progress: [] });
});
