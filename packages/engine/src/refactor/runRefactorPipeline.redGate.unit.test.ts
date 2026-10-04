import { execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { runRefactorPipeline } from '#src/refactor/runRefactorPipeline.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

/** Two exported consts in one file — a compiler-free structure Finding (multi-export). */
const multiExport = 'export const alphaThing = 1;\nexport const betaThing = 2;\n';

const commitAll = (dir: string) => execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm fixture', { cwd: dir });

/** Split a multi-export file in two, each half with the caller that uses it — an unreferenced half is its own blocking finding. */
const splitFile = ({ dir, file, first, second }: { dir: string; file: string; first: string; second: string }) => {
	writeSource({ dir, path: file, source: `export const ${first} = 1;\n` });
	writeSource({ dir, path: file.replace(/[^/]+\.ts$/, `${second}.ts`), source: `export const ${second} = 2;\n` });
};

/**
 * One finding plus a `check` gate that stays red while broken.flag exists —
 * the executor plants the flag, so verification fails on work that otherwise
 * resolved the cluster.
 */
const setupRedGateBatch = async () => {
	const dir = setupConsumerRepo({ scripts: { check: 'test ! -f broken.flag' } });

	writeSource({ dir, path: 'src/multi.ts', source: multiExport });
	commitAll(dir);

	const prompts: string[] = [];
	const gateBreakingExecutor: Driver['invoke'] = async ({ prompt }) => {
		if (roleOf(prompt) === 'standards-review') {
			return { text: reviewReport(), exitCode: 0 };
		}

		prompts.push(prompt);

		splitFile({ dir, file: 'src/multi.ts', first: 'alphaThing', second: 'betaThing' });
		writeFileSync(join(dir, 'broken.flag'), 'red\n');

		return {
			text: report({
				changedFiles: [
					{ path: 'src/multi.ts', summary: 'split' },
					{ path: 'src/betaThing.ts', summary: 'split' },
				],
			}),
			exitCode: 0,
		};
	};

	return { dir, prompts, gateBreakingExecutor, config: await readConfig({ cwd: dir }) };
};

describe('runRefactorPipeline red gates', () => {
	test('a cheap fix rescues a red gate without spending a supervisor consult', async () => {
		const { dir, prompts, gateBreakingExecutor, config } = await setupRedGateBatch();
		const driver: Driver = {
			name: 'stub',
			invoke: async (invocation) => {
				if (roleOf(invocation.prompt) === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				if (invocation.prompt.includes('# Verification failure')) {
					prompts.push(invocation.prompt);
					rmSync(join(dir, 'broken.flag'));

					return { text: report(), exitCode: 0 };
				}

				return gateBreakingExecutor(invocation);
			},
		};

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config } });

		expect(result.ok).toBe(true);
		// the batch resolved once the gate went green
		expect(result.after['lightsout/multi-export'] ?? 0).toBe(0);
		// one executor pass plus one cheap fix
		expect(prompts.length).toBe(2);
		// judgment is only bought when the mechanical retries are exhausted
		expect(prompts.every((prompt) => !prompt.includes('# Failing step'))).toBeTruthy();
	});

	test('an invocation failure whose work is done but whose gates are red is not salvaged', async () => {
		const { dir, config } = await setupRedGateBatch();
		const driver: Driver = {
			name: 'stub',
			invoke: async ({ prompt }) => {
				if (roleOf(prompt) === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				splitFile({ dir, file: 'src/multi.ts', first: 'alphaThing', second: 'betaThing' });
				writeFileSync(join(dir, 'broken.flag'), 'red\n');

				return { text: 'no json here — the process died mid-report', exitCode: 1 };
			},
		};

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config } });

		// the clusters are gone from the tree, but a red gate is not "work verified"
		expect(result.ok).toBe(false);
		expect(result.manifest.status).toBe('failed');
		// the failure names the batch it stopped at
		expect(result.error ?? '').toMatch(/batch-01:lightsout\/multi-export:src: /);
		// and is never re-labelled as a resolution
		expect(JSON.stringify(result.manifest.steps).includes('salvaged')).toBeFalsy();
	});

	test('a rate-limited cheap fix parks the run instead of failing it', async () => {
		const { dir, prompts, gateBreakingExecutor, config } = await setupRedGateBatch();
		const driver: Driver = {
			name: 'stub',
			invoke: async (invocation) => {
				if (roleOf(invocation.prompt) === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				if (invocation.prompt.includes('# Verification failure')) {
					prompts.push(invocation.prompt);

					return { text: 'usage limit reached', exitCode: 1, rateLimited: true };
				}

				return gateBreakingExecutor(invocation);
			},
		};

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config } });

		expect(result.ok).toBe(false);
		// a rate limit mid-fix is pausable state, never an error
		expect(result.manifest.status).toBe('paused-rate-limit');
		// the run stopped at the rate-limited fix — no second retry, no supervisor
		expect(prompts.length).toBe(2);
	});
});
