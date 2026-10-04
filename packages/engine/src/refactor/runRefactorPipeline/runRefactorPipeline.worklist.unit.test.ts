import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import { runRefactorPipeline } from '#src/refactor/runRefactorPipeline/runRefactorPipeline.ts';
import { linkTypescript } from '#tests/helpers/linkTypescript.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

/** Two exported consts in one file — a compiler-free structure Finding (multi-export). */
const multiExport = 'export const alphaThing = 1;\nexport const betaThing = 2;\n';

/** An over-cap function body — the size rule's advisory, which needs the AST tier. */
const bigFunction = `export const bigThing = (): number => {\n${Array.from({ length: 85 }, (_, index) => `\tconst v${index} = ${index};`).join('\n')}\n\treturn v0;\n};\n`;

const commitAll = (dir: string) => execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm fixture', { cwd: dir });

/**
 * A two-folder repo (alpha/ and beta/), one multi-export finding in each, and
 * a driver that judges every batch fine as-is while recording the prompts it
 * was handed — so which findings reached an agent is observable.
 */
const setupTwoFolderRun = async () => {
	const dir = setupConsumerRepo();

	for (const folder of ['alpha', 'beta']) {
		mkdirSync(join(dir, folder), { recursive: true });
		writeSource({ dir, path: `${folder}/multi.ts`, source: multiExport });
	}

	commitAll(dir);

	const prompts: string[] = [];
	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt }) => {
			if (roleOf(prompt) === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			prompts.push(prompt);

			return { text: report({ friction: [{ area: 'other', kind: 'decision', detail: 'left as-is: exempt by design' }] }), exitCode: 0 };
		},
	};

	return { dir, driver, prompts, config: await readConfig({ cwd: dir }) };
};

/** A standalone `lightsout standards-check` report already on disk when the run starts. */
const priorReport = `${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', path: '.', findings: [], notes: [] })}\n`;

/**
 * One multi-export finding, optionally a report file left by an earlier
 * standalone check, and a driver that must never be reached — the run parks at
 * the budget ceiling, so what the work-list build did is observable before any
 * batch touches the tree.
 */
const setupParkedRun = async ({ report }: { report?: string } = {}) => {
	const dir = setupConsumerRepo();

	writeSource({ dir, path: 'src/multi.ts', source: multiExport });
	commitAll(dir);

	if (report) {
		mkdirSync(join(dir, '.lightsout'), { recursive: true });
		writeFileSync(join(dir, '.lightsout/standards-check.json'), report);
	}

	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt }) => {
			if (roleOf(prompt) === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			throw new Error('the budget ceiling must be reached before any agent is spawned');
		},
	};

	return { dir, driver, config: await readConfig({ cwd: dir }) };
};

/**
 * Two findings, one per package under the DEFAULT packages dir — the other arm
 * of the grouping the configured-packagesDir test covers.
 */
const setupDefaultPackagesRun = async () => {
	const dir = setupConsumerRepo();

	mkdirSync(join(dir, 'packages/api'), { recursive: true });
	mkdirSync(join(dir, 'packages/web'), { recursive: true });
	writeSource({ dir, path: 'packages/api/multi.ts', source: multiExport });
	writeSource({ dir, path: 'packages/web/pair.ts', source: 'export const gammaThing = 3;\nexport const deltaThing = 4;\n' });
	commitAll(dir);

	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt }) => {
			if (roleOf(prompt) === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			throw new Error('the budget ceiling must be reached before any agent is spawned');
		},
	};

	return { dir, driver, config: await readConfig({ cwd: dir }) };
};

/** The frozen work-list the run wrote into its run dir, re-read through its contract. */
const readWorklist = ({ dir, plan }: { dir: string; plan: string }) => RefactorWorklist.parse(JSON.parse(readFileSync(join(dir, plan), 'utf8')));

describe('runRefactorPipeline work-list', () => {
	test('a check scope confines the run to that subtree and is frozen with the work-list', async () => {
		const { dir, driver, prompts, config } = await setupTwoFolderRun();

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config }, path: 'alpha' });

		expect(result.ok).toBe(true);
		// only the in-scope finding counts as work
		expect(result.before).toStrictEqual({ 'lightsout/multi-export': 1 });
		// the out-of-scope folder never became a batch
		expect(result.declined.map((entry) => entry.batchId)).toStrictEqual(['batch-01:lightsout/multi-export:alpha']);
		// no agent was pointed outside the scope:\n${prompts.join('\n\n')}
		expect(prompts.every((prompt) => !prompt.includes('beta/multi.ts'))).toBeTruthy();

		const worklist = readWorklist({ dir, plan: result.manifest.plan });

		// the scope is frozen with the work-list, so resume checks the same subtree
		expect(worklist.path).toBe('alpha');
		expect(worklist.batches.map((batch) => batch.id)).toStrictEqual(['batch-01:lightsout/multi-export:alpha']);
	});

	test('the frozen work-list carries Finding-severity work with every advisory as context', async () => {
		const dir = setupConsumerRepo();

		linkTypescript({ dir });
		writeSource({ dir, path: 'src/multi.ts', source: `export const alphaThing = 1;\n${bigFunction}` });
		// a second, near-identical copy: a different advisory rule from the size one,
		// which is the whole point of the assertion below
		writeSource({ dir, path: 'src/bigThingCopy.ts', source: bigFunction.replace('bigThing', 'bigThingCopy') });
		commitAll(dir);

		const driver: Driver = {
			name: 'stub',
			invoke: async ({ prompt }) => {
				if (roleOf(prompt) === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				throw new Error('the budget ceiling must be reached before any agent is spawned');
			},
		};
		const result = await runRefactorPipeline({
			cwd: dir,
			driver,
			config: await readConfig({ cwd: dir }),
			loadedConfig: { config: await readConfig({ cwd: dir }) },
			maxBatches: 0,
		});

		expect(result.manifest.status).toBe('paused-budget');

		const worklist = readWorklist({ dir, plan: result.manifest.plan });
		const advisories = worklist.batches.flatMap((batch) => batch.advisories);

		// the over-cap function rode along as context
		expect(advisories.length > 0).toBeTruthy();
		// EVERY advisory rides along, not just the size ones — each carries its own
		// guidance, and one the agent never sees is one it can never judge
		expect([...new Set(advisories.map((advisory) => advisory.rule))].sort()).toStrictEqual([
			'lightsout/duplicate-code-block',
			'lightsout/file-placement',
			'lightsout/function-size',
		]);
		// advisories are never batched as work
		expect([...new Set(worklist.batches.flatMap((batch) => batch.blocking.map((finding) => finding.severity)))]).toStrictEqual(['blocking']);
	});

	test('a configured packagesDir batches by package rather than by the shared parent folder', async () => {
		const dir = setupConsumerRepo({ config: { 'packages-dir': 'modules' } });

		mkdirSync(join(dir, 'modules/api'), { recursive: true });
		mkdirSync(join(dir, 'modules/web'), { recursive: true });
		writeSource({ dir, path: 'modules/api/multi.ts', source: multiExport });
		writeSource({ dir, path: 'modules/web/pair.ts', source: 'export const gammaThing = 3;\nexport const deltaThing = 4;\n' });
		commitAll(dir);

		const driver: Driver = {
			name: 'stub',
			invoke: async ({ prompt }) => {
				if (roleOf(prompt) === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				throw new Error('the budget ceiling must be reached before any agent is spawned');
			},
		};
		const result = await runRefactorPipeline({
			cwd: dir,
			driver,
			config: await readConfig({ cwd: dir }),
			loadedConfig: { config: await readConfig({ cwd: dir }) },
			maxBatches: 0,
		});

		expect(result.manifest.status).toBe('paused-budget');

		const worklist = readWorklist({ dir, plan: result.manifest.plan });

		// each package is its own batch area — on the default packagesDir both
		// findings would collapse into a single `modules` batch, pointing one agent
		// at two packages
		expect([...new Set(worklist.batches.map((batch) => batch.folder))].filter((folder) => folder.startsWith('modules'))).toStrictEqual([
			'modules/api',
			'modules/web',
		]);
	});

	test('an unconfigured packagesDir still batches per package under packages/', async () => {
		const { dir, driver, config } = await setupDefaultPackagesRun();

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config }, maxBatches: 0 });

		expect(result.manifest.status).toBe('paused-budget');

		const worklist = readWorklist({ dir, plan: result.manifest.plan });

		// 'packages' is the default the work-list supplies — without it both
		// findings would share one `packages` batch, pointing one agent at two
		// packages
		expect([...new Set(worklist.batches.map((batch) => batch.folder))].filter((folder) => folder.startsWith('packages'))).toStrictEqual([
			'packages/api',
			'packages/web',
		]);
	});

	test('a run given no scope and no mode freezes the whole repo, baseline-filtered', async () => {
		const { dir, driver, config } = await setupParkedRun();

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config }, maxBatches: 0 });

		expect(result.manifest.status).toBe('paused-budget');

		const worklist = readWorklist({ dir, plan: result.manifest.plan });

		// '.' is the exact value a resumed run reads back to decide it has no
		// subpath scope, and `all: false` is what keeps accepted debt out of it
		expect(worklist).toEqual(expect.objectContaining({ path: '.', all: false }));
	});

	test('building the work-list leaves an existing standards-check report untouched', async () => {
		const { dir, driver, config } = await setupParkedRun({ report: priorReport });

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config }, maxBatches: 0 });

		expect(result.manifest.status).toBe('paused-budget');
		// the work-list's check persists nothing: a refactor run must not clobber
		// the report the user's own `lightsout standards-check` left behind
		expect(readFileSync(join(dir, '.lightsout/standards-check.json'), 'utf8')).toBe(priorReport);
	});

	test('a repo outside any git worktree is refused before any run state exists', async () => {
		const dir = setupConsumerRepo({ git: false });

		writeSource({ dir, path: 'src/multi.ts', source: multiExport });

		const driver: Driver = {
			name: 'stub',
			invoke: async ({ prompt }) => {
				if (roleOf(prompt) === 'standards-review') {
					return { text: reviewReport(), exitCode: 0 };
				}

				throw new Error('no agent may be spawned where the diff cannot be attributed');
			},
		};

		await expect(
			runRefactorPipeline({ cwd: dir, driver, config: await readConfig({ cwd: dir }), loadedConfig: { config: await readConfig({ cwd: dir }) } }),
		).rejects.toThrow(/requires a git worktree/);
	});
});
