import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import { runRefactorPipeline } from '#src/refactor/runRefactorPipeline/runRefactorPipeline.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { writeSource } from '#tests/helpers/writeSource.ts';

/** Two exported consts in one file — a compiler-free structure Finding (multi-export). */
const multiExport = 'export const alphaThing = 1;\nexport const betaThing = 2;\n';

const commitAll = (dir: string) => execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm fixture', { cwd: dir });

/** Split the fixture's multi-export file — the shape that burns the finding down. */
const splitMulti = ({ dir, file }: { dir: string; file: string }) => {
	writeFileSync(join(dir, file), 'export const alphaThing = 1;\n');
	writeFileSync(join(dir, file.replace(/[^/]+\.ts$/, 'betaThing.ts')), 'export const betaThing = 2;\n');
};

/**
 * One multi-export finding whose cluster is already accepted in the committed
 * baseline ledger — the burn-down's starting position — plus a driver that
 * splits the file and records whether it was ever asked to.
 */
const setupBaselinedRun = async () => {
	const dir = setupConsumerRepo();

	writeSource({ dir, path: 'src/multi.ts', source: multiExport });
	writeFileSync(
		join(dir, 'lightsout.standards-baseline.json'),
		`${JSON.stringify({ at: '2026-01-01T00:00:00.000Z', path: '.', siteKeys: ['lightsout/multi-export:src/multi.ts'] })}\n`,
	);
	commitAll(dir);

	const prompts: string[] = [];
	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt }) => {
			if (roleOf(prompt) === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			prompts.push(prompt);
			splitMulti({ dir, file: 'src/multi.ts' });

			return {
				text: report({
					changedFiles: [
						{ path: 'src/multi.ts', summary: 'split' },
						{ path: 'src/betaThing.ts', summary: 'split' },
					],
				}),
				exitCode: 0,
			};
		},
	};

	return { dir, driver, prompts, config: await readConfig({ cwd: dir }) };
};

/**
 * Two multi-export findings in ONE folder — two findings of the SAME rule, so
 * the burn-down tally has something to add up rather than merely list. The
 * driver judges the batch fine as-is, leaving both findings standing.
 */
const setupTwoFindingFolder = async () => {
	const dir = setupConsumerRepo();

	writeSource({ dir, path: 'src/one.ts', source: 'export const alphaOne = 1;\nexport const betaOne = 2;\n' });
	writeSource({ dir, path: 'src/two.ts', source: 'export const alphaTwo = 1;\nexport const betaTwo = 2;\n' });
	commitAll(dir);

	const driver: Driver = {
		name: 'stub',
		invoke: async () => ({ text: report({ friction: [{ area: 'other', kind: 'decision', detail: 'left as-is: exempt by design' }] }), exitCode: 0 }),
	};

	return { dir, driver, config: await readConfig({ cwd: dir }) };
};

/** The frozen work-list the run wrote into its run dir, re-read through its contract. */
const readWorklist = ({ dir, plan }: { dir: string; plan: string }) => RefactorWorklist.parse(JSON.parse(readFileSync(join(dir, plan), 'utf8')));

describe('runRefactorPipeline burn-down', () => {
	test('the burn-down tally adds up every finding of a rule, not one entry per rule', async () => {
		const { dir, driver, config } = await setupTwoFindingFolder();

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config } });

		expect(result.ok).toBe(true);
		// both findings carry the 'multi-export' rule and must accumulate under it
		expect(result.before).toStrictEqual({ 'lightsout/multi-export': 2 });
		// nothing was resolved, so the closing re-check tallies the same two
		expect(result.after).toStrictEqual({ 'lightsout/multi-export': 2 });
	});

	test('a baselined finding is not work — the run completes as a verdict, spawning nothing', async () => {
		const { dir, driver, prompts, config } = await setupBaselinedRun();

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config } });

		expect(result.ok).toBe(true);
		expect(result.manifest.status).toBe('passed');
		// accepted debt is not the refactor run’s work
		expect(result.before).toStrictEqual({});
		// no agent was spent on already-accepted debt
		expect(prompts.length).toBe(0);
	});

	test('burn-down mode takes the baselined finding as work and burns it down', async () => {
		const { dir, driver, prompts, config } = await setupBaselinedRun();

		const result = await runRefactorPipeline({ cwd: dir, driver, config, loadedConfig: { config }, all: true });

		expect(result.ok).toBe(true);
		// the accepted cluster is the work-list in burn-down mode
		expect(result.before['lightsout/multi-export']).toBe(1);
		// and it burned down
		expect(result.after['lightsout/multi-export'] ?? 0).toBe(0);
		// the batch reached an agent
		expect(prompts.length > 0).toBeTruthy();

		const worklist = readWorklist({ dir, plan: result.manifest.plan });

		// the mode is frozen with the work-list, so resume re-checks the same way
		expect(worklist.all).toBe(true);
	});
});
