import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { runRefactorPipeline } from '#src/refactor/runRefactorPipeline/runRefactorPipeline.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

/** Two exported consts in one file — a compiler-free structure Finding (multi-export). */
const multiExport = 'export const alpha = 1;\nexport const beta = 2;\n';

/** A driver that judges every finding fine as-is: complete, zero changes. */
const decliningDriver: Driver = {
	name: 'stub',
	invoke: async () => ({
		text: report({ friction: [{ area: 'other', kind: 'decision', detail: 'left as-is: exempt by design' }] }),
		exitCode: 0,
	}),
};

test('refactor: zero changes with persisting clusters is a decline — recorded, run still ok', async () => {
	const dir = setupConsumerRepo({ sources: { 'src/multi.ts': multiExport } });

	const result = await runRefactorPipeline({
		cwd: dir,
		driver: decliningDriver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
	});

	expect(result.ok).toBe(true);
	expect(result.declined.length).toBe(1);
	// the persisting cluster is named
	expect(result.declined[0]?.remainingSiteKeys[0]?.startsWith('lightsout/multi-export:')).toBeTruthy();
	// the agent's rationale rides along
	expect(result.declined[0]?.rationale[0]?.includes('left as-is')).toBeTruthy();
});

test('refactor: three consecutive declines stop the run as systemic', async () => {
	const dir = setupConsumerRepo({ sources: Object.fromEntries(['alpha', 'beta', 'gamma'].map((folder) => [`${folder}/multi.ts`, multiExport])) });

	const result = await runRefactorPipeline({
		cwd: dir,
		driver: decliningDriver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
	});

	expect(result.ok).toBe(false);
	expect(result.error ?? '').toMatch(/consecutive batches declined/);
	expect(result.manifest.status).toBe('escalated');
	expect(result.declined.length).toBe(3);
});

test('refactor: declines recorded before a park survive the resume (report, streak, and all)', async () => {
	const dir = setupConsumerRepo({ sources: Object.fromEntries(['alpha', 'beta'].map((folder) => [`${folder}/multi.ts`, multiExport])) });

	let betaCalls = 0;
	const driver: Driver = {
		name: 'stub',
		invoke: async (invocation) => {
			if (roleOf(invocation.prompt) === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			if (invocation.prompt.includes('- [lightsout/multi-export] alpha/multi.ts')) {
				return { text: report({ friction: [{ area: 'other', kind: 'decision', detail: 'alpha left as-is' }] }), exitCode: 0 };
			}

			betaCalls += 1;

			if (betaCalls === 1) {
				return { text: 'usage limit reached', exitCode: 1, rateLimited: true };
			}

			writeSource({ dir, path: 'beta/multi.ts', source: 'export const alpha = 1;\n' });
			writeSource({ dir, path: 'beta/beta.ts', source: 'export const beta = 2;\n' });

			return {
				text: report({
					changedFiles: [
						{ path: 'beta/multi.ts', summary: 'split' },
						{ path: 'beta/beta.ts', summary: 'split' },
					],
				}),
				exitCode: 0,
			};
		},
	};

	const config = await readConfig({ cwd: dir });
	const parked = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config } });

	expect(parked.manifest.status).toBe('paused-rate-limit');
	// alpha declined before the park
	expect(parked.declined.length).toBe(1);

	const existing = await readRunManifest({ cwd: dir, runId: parked.manifest.runId });
	const resumed = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config }, existing });

	expect(resumed.ok).toBe(true);
	// the pre-park decline survives the resume — it is the run's deliverable
	expect(resumed.declined.length).toBe(1);
	expect(resumed.declined[0]?.batchId.includes('alpha')).toBeTruthy();
	expect(resumed.declined[0]?.rationale[0]?.includes('alpha left as-is')).toBeTruthy();
	// and names what still persists, read back off the persisted report rather
	// than process memory — a decline the human cannot locate is not reviewable
	expect(resumed.declined[0]?.remainingSiteKeys).toStrictEqual(['lightsout/multi-export:alpha/multi.ts']);
});

test('refactor: terminated:scope is a decline that continues, not a run-ending escalation', async () => {
	const dir = setupConsumerRepo({ sources: Object.fromEntries(['alpha', 'beta'].map((folder) => [`${folder}/multi.ts`, multiExport])) });

	const driver: Driver = {
		name: 'stub',
		invoke: async (invocation) => {
			if (roleOf(invocation.prompt) === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			if (invocation.prompt.includes('- [lightsout/multi-export] alpha/multi.ts')) {
				return { text: report({ status: 'terminated:scope', failures: ['cannot be resolved in scope'] }), exitCode: 0 };
			}

			writeSource({ dir, path: 'beta/multi.ts', source: 'export const alpha = 1;\n' });
			writeSource({ dir, path: 'beta/beta.ts', source: 'export const beta = 2;\n' });

			return {
				text: report({
					changedFiles: [
						{ path: 'beta/multi.ts', summary: 'split' },
						{ path: 'beta/beta.ts', summary: 'split' },
					],
				}),
				exitCode: 0,
			};
		},
	};

	const result = await runRefactorPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
	});

	// a scope refusal must not end the run: ${result.error}
	expect(result.ok).toBe(true);
	// the scope refusal is recorded as a decline
	expect(result.declined.length).toBe(1);
	// the refusal reason rides the decline
	expect(result.declined[0]?.rationale.some((line) => line.includes('cannot be resolved in scope'))).toBeTruthy();
	// the other batch still ran and resolved
	expect(result.after['lightsout/multi-export'] ?? 0).toBe(1);
});
