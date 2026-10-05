import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { RefactorStepReport } from '#src/contracts/run/RefactorStepReport.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline/runImplementPipeline.ts';
import { attributionDriver } from '#tests/helpers/attributionDriver.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { withTestChangeReview } from '#tests/helpers/withTestChangeReview.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

// The standards gate: findings feed the refactor prompt, the config switch is
// honored, and a pack that cannot load stops the run.

test('standards gate: findings feed the refactor prompt; a fixing pass clears the gate', async () => {
	const dir = setupConsumerRepo();
	const prompts: string[] = [];
	const driver = attributionDriver({
		dir,
		testFile: 'test/messy.test.js',
		refactorPrompts: prompts,
		// Implement plants a multi-export violation — the standards gate's target.
		implement: () => {
			writeSource({ dir, path: 'src/messy.js', source: 'export const first = () => 1;\nexport const second = () => 2;\n' });

			return ['src/messy.js'];
		},
		// First pass fixes the planted multi-export; later passes are clean. The
		// fixed file exports nothing at all, so no advisory (a filename mismatch,
		// an unconsumed export) survives to keep the section alive.
		onRefactor: ({ pass }) => {
			if (pass > 1) {
				return report();
			}

			writeFileSync(join(dir, 'src/messy.js'), "import { one } from './index.js';\n\nconsole.log(one);\n");

			return report({ changedFiles: [{ path: 'src/messy.js', summary: 'split exports' }] });
		},
	});

	const progress: string[] = [];
	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
		onProgress: (message) => progress.push(message),
	});

	expect(result.ok).toBe(true);
	// gate narrated the finding — the work-list count IS the blocking count now,
	// so there is no second number to print
	expect(progress.some((line) => line.startsWith('standards gate: 1 blocking'))).toBeTruthy();
	// findings section injected into the refactor prompt
	expect(prompts[0]?.includes('# Standards findings')).toBeTruthy();
	// the planted violation named in the work-list
	expect(prompts[0]?.includes('[lightsout/multi-export] src/messy.js')).toBeTruthy();
	// clean tree injects no findings section
	expect(prompts[1]?.includes('# Standards findings')).toBeFalsy();
	// because the fixing pass cleared the gate, so no second round was ever bought
	expect(RefactorStepReport.parse(result.manifest.steps.find((step) => step.id === 'refactor')?.report)).toEqual(
		expect.objectContaining({ roundsUsed: 1, endReason: 'clean', remaining: [] }),
	);
});

test('the pack the config names reaches the implement prompt; false switches standards off explicitly', async () => {
	const run = async ({ config }: { config: Record<string, unknown> }) => {
		const dir = setupConsumerRepo({ config });
		let implementPrompt = '';
		const driver: Driver = {
			name: 'stub',
			invoke: withTestChangeReview({
				invoke: async ({ prompt, systemPrompt }) => {
					if (roleOf(prompt) === 'implement') {
						// Standards ride the system prompt — stable for the run, so cached.
						implementPrompt = systemPrompt ?? '';

						return { text: report({ status: 'failed', failures: ['stop early'] }), exitCode: 0 };
					}

					return { text: report(), exitCode: 0 };
				},
			}),
		};

		await runImplementPipeline({
			cwd: dir,
			driver,
			config: await readConfig({ cwd: dir }),
			loadedConfig: { config: await readConfig({ cwd: dir }) },
			planPath: 'plan.md',
		});

		return implementPrompt;
	};

	const named = await run({ config: {} });

	// the helper's config names lightsout/standards → standards section present
	expect(named.includes('# Standards\n\nThese rules are binding')).toBeTruthy();
	// the pack's rules are inlined
	expect(named.includes('File Placement')).toBeTruthy();

	const disabled = await run({ config: { 'standards-pack': false } });

	// false → no standards section
	expect(disabled.includes('# Standards\n\nThese rules are binding')).toBeFalsy();
});

test('a declared standards pack that cannot be loaded stops the run before any agent spawns', async () => {
	const dir = setupConsumerRepo({ config: { 'standards-pack': 'lightsout/ghost' } });
	const driver: Driver = {
		name: 'stub',
		invoke: async () => {
			throw new Error('no agent should be invoked');
		},
	};
	const progress: string[] = [];

	const result = await runImplementPipeline({
		cwd: dir,
		driver,
		config: await readConfig({ cwd: dir }),
		loadedConfig: { config: await readConfig({ cwd: dir }) },
		planPath: 'plan.md',
		onProgress: (message) => progress.push(message),
	});

	// a consumer that declared standards and did not get them must not run: the
	// load failure comes back as a failed manifest, never as a thrown crash that
	// would leave the run with no record of why it ended
	expect(result.ok).toBe(false);
	expect(result.manifest.status).toBe('failed');
	expect(result.error ?? '').toMatch(/pack lightsout\/ghost: names no pack/);

	const cleanSlate = result.manifest.steps.find((step) => step.id === 'clean-slate');

	// the run stopped at the first step without ever attempting it — a zero
	// attempt count is what distinguishes "never started" from "ran and failed"
	expect(cleanSlate?.status).toBe('failed');
	expect(cleanSlate?.attempts).toBe(0);
	expect(progress.some((line) => line.startsWith('run stopped at clean-slate'))).toBeTruthy();
});

/**
 * A run whose implement step lands one clean source file and whose refactor
 * pass declines, so the config is the only thing left deciding what the
 * standards half of the gate does. The reviewer's system prompt is collected —
 * it carries the rules the pack resolution selected, so it is where a config
 * the gate failed to honor shows up — and an empty list of prompts is
 * a review that was never bought at all.
 */
const setupStandardsConfigRun = async ({ config }: { config: Record<string, unknown> }) => {
	const dir = setupConsumerRepo({ config });
	const reviewSystemPrompts: string[] = [];
	const driver: Driver = {
		name: 'stub',
		invoke: withTestChangeReview({
			invoke: async ({ prompt, systemPrompt }) => {
				const role = roleOf(prompt);

				if (role === 'standards-review') {
					reviewSystemPrompts.push(systemPrompt ?? '');

					return { text: reviewReport(), exitCode: 0 };
				}

				if (role === 'write-tests') {
					mkdirSync(join(dir, 'test'), { recursive: true });
					writeFileSync(join(dir, 'test/subject.test.js'), '// stub\n');

					return { text: report({ changedFiles: [{ path: 'test/subject.test.js', summary: 'tests' }] }), exitCode: 0 };
				}

				if (role === 'refactor') {
					return { text: report({ changedFiles: [] }), exitCode: 0 };
				}

				writeSource({ dir, path: 'src/subject.js', source: 'export const subject = () => 1;\n' });

				return { text: report({ changedFiles: [{ path: 'src/subject.js', summary: 'feature' }] }), exitCode: 0 };
			},
		}),
	};

	return { dir, driver, config: await readConfig({ cwd: dir }), reviewSystemPrompts };
};

test('standards packs off: the refactor gate loads no pack, spends no reviewer, and the loop still completes', async () => {
	const { dir, driver, config, reviewSystemPrompts } = await setupStandardsConfigRun({ config: { 'standards-pack': false } });

	const result = await runImplementPipeline({ cwd: dir, driver, config, loadedConfig: { config }, planPath: 'plan.md' });

	// no pack means no agent-checked rule to read, so no agent is spent saying so —
	// and the machine half having nothing to report is what lets the loop finish
	expect(reviewSystemPrompts).toStrictEqual([]);
	expect(result.ok).toBe(true);
	expect(result.manifest.steps.find((step) => step.id === 'refactor')?.status).toBe('passed');
});
