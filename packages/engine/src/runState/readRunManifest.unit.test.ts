import { writeFile } from 'node:fs/promises';
import { describe, expect, test } from '@jest/globals';
import { createRun } from '#src/runState/createRun.ts';
import { getRunManifestPath } from '#src/runState/internal/common/paths/getRunManifestPath.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

describe('readRunManifest', () => {
	test('reads a run by the shortened id its own report printed', async () => {
		const cwd = setupConsumerRepo({ git: false });
		const created = await createRun({ cwd, plan: 'plan.md', driver: 'stub' });

		const manifest = await readRunManifest({ cwd, runId: created.runId.slice(0, 8) });

		expect(manifest.runId).toBe(created.runId);
	});

	test('reports an unknown run by name rather than by the file it failed to open', async () => {
		const cwd = setupConsumerRepo({ git: false });
		await createRun({ cwd, plan: 'plan.md', driver: 'stub' });

		// the old failure was a raw ENOENT naming .lightsout/runs/<id>/manifest.json
		await expect(readRunManifest({ cwd, runId: 'nosuchrun' })).rejects.toThrow(RunNotFoundError);
	});

	test("reads a run whose recorded config this engine's config schema would reject", async () => {
		const cwd = setupConsumerRepo({ git: false });
		const created = await createRun({ cwd, plan: 'plan.md', driver: 'stub' });
		// `standards-pak` is a misspelling the strict config schema refuses
		const recordedConfig = { gates: { check: 'true' }, 'standards-pak': 'acme/house' };
		const manifestPath = await getRunManifestPath({ cwd, runId: created.runId });
		await writeFile(manifestPath, JSON.stringify({ ...created, config: recordedConfig }));

		const manifest = await readRunManifest({ cwd, runId: created.runId });

		expect({ runId: manifest.runId, config: manifest.config }).toStrictEqual({ runId: created.runId, config: recordedConfig });
	});
});
