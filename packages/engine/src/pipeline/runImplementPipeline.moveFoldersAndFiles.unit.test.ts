import { existsSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline.ts';
import { report } from '#tests/helpers/report.ts';
import { reviewReport } from '#tests/helpers/reviewReport.ts';
import { roleOf } from '#tests/helpers/roleOf.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { verdict } from '#tests/helpers/verdict.ts';

/** A plan whose whole work is one folder move, declared the way a move-folders-and-files plan declares it. */
const planContent = [
	'# Plan: move the feature folder to widget',
	'',
	'## Build Mode',
	'',
	'move-folders-and-files',
	'',
	'## Files to Move',
	'',
	'### `src/feature/` → `src/widget/`',
	'',
].join('\n');

/**
 * The committed repo: a folder the move carries, and a module outside it that
 * imports from it. `setupConsumerRepo` plants a consumer beside each —
 * `src/feature/useFeature.js` inside the folder, which moves with it unchanged,
 * and `src/useCount.js` beside the importer, which the move never touches.
 */
const committedSources = {
	'src/feature/feature.js': 'export const feature = (n) => n + 1;\n',
	'src/count.js': "import { feature } from './feature/feature.js';\n\nexport const count = () => feature(1);\n",
};

/** The marker the verify-tests gate prints when it goes red, so the repair it hands out can be recognised. */
const buildRedMarker = 'BUILD-RED';

/** The cheap gates at the first two checkpoints, and the `build` gate added at verify-tests alone. */
const verifyTestsOnlyBuild = {
	'clean-slate': ['check', 'test'],
	'verify-implement': ['check', 'test'],
	'verify-tests': ['check', 'test', 'build'],
};

/**
 * The declared folder move carried out by hand, as the implement agent carries
 * it out: the folder moved whole to its new path, and the importer outside it
 * re-pointed. `increment` is what the moved `feature` adds — anything but 1 is
 * a change no move explains. Safe to run twice: a fix turn finds the folder
 * already moved.
 */
const applyTheMove = ({ dir, increment }: { dir: string; increment: number }) => {
	if (existsSync(join(dir, 'src/feature'))) {
		renameSync(join(dir, 'src/feature'), join(dir, 'src/widget'));
	}

	writeFileSync(join(dir, 'src/widget/feature.js'), `export const feature = (n) => n + ${increment};\n`);
	writeFileSync(join(dir, 'src/count.js'), "import { feature } from './widget/feature.js';\n\nexport const count = () => feature(1);\n");
};

const movedFiles = [
	{ path: 'src/widget/feature.js', summary: 'moved from src/feature/feature.js' },
	{ path: 'src/widget/useFeature.js', summary: 'moved from src/feature/useFeature.js' },
	{ path: 'src/count.js', summary: 're-pointed the import' },
];

/**
 * Which role a stub invocation is answering. The test-change reviewer is named
 * by its bundle heading and the ledger writer by its assignment heading — both
 * would otherwise fall through `roleOf` to another role.
 */
const roleFor = ({ prompt }: { prompt: string }) => {
	if (prompt.includes('# Changed test-side files')) {
		return 'test-review';
	}

	if (prompt.includes('# Ledger tests to write')) {
		return 'write-ledger-tests';
	}

	return roleOf(prompt);
};

interface SetupParams {
	/** What the implement agent's first turn leaves the moved `feature` adding; the fix turn always restores 1. */
	implementIncrement?: number;
	/** Give verify-tests alone a gate that stays red until a fix turn has run. */
	redVerifyTestsGate?: boolean;
}

/**
 * A consumer repo carrying a move-folders-and-files plan, driven by a stub that
 * answers every role. The implement agent and its fix turn carry out the move;
 * every other role answers with an empty report, and nothing answers a
 * test-change review honestly — a review reaching this stub fails the run on
 * the contract.
 *
 * The red verify-tests gate is a `build` command reading a flag file outside
 * the repo, which only the fix turn writes. Outside the repo, because the flag
 * is not a move, and a move-folders-and-files run refuses any file the move
 * does not explain. The two earlier checkpoints are held to the cheap gates so
 * the flag is asked for at verify-tests alone.
 */
const setupMoveRun = async ({ implementIncrement = 1, redVerifyTestsGate = false }: SetupParams = {}) => {
	const flagPath = join(mkdtempSync(join(tmpdir(), 'lightsout-move-flag-')), 'fixed');
	const dir = setupConsumerRepo({
		plan: planContent,
		sources: committedSources,
		...(redVerifyTestsGate
			? {
					scripts: { build: `test -f ${flagPath} || (echo ${buildRedMarker} >&2; exit 1)` },
					config: { 'gate-overrides': verifyTestsOnlyBuild },
				}
			: {}),
	});
	const invocations: { role: string; prompt: string; systemPrompt?: string }[] = [];

	const driver: Driver = {
		name: 'stub',
		invoke: async ({ prompt, systemPrompt }) => {
			const role = roleFor({ prompt });

			invocations.push({ role, prompt, systemPrompt });

			if (role === 'standards-review') {
				return { text: reviewReport(), exitCode: 0 };
			}

			if (role === 'supervisor') {
				return { text: verdict(), exitCode: 0 };
			}

			if (role === 'implement') {
				applyTheMove({ dir, increment: implementIncrement });

				return { text: report({ changedFiles: movedFiles }), exitCode: 0 };
			}

			if (role === 'fix') {
				applyTheMove({ dir, increment: 1 });
				writeFileSync(flagPath, 'fixed\n');

				return { text: report({ changedFiles: movedFiles }), exitCode: 0 };
			}

			return { text: report(), exitCode: 0 };
		},
	};

	return { dir, driver, invocations, config: await readConfig({ cwd: dir }) };
};

describe('runImplementPipeline', () => {
	test('a move-folders-and-files plan skips both test writers and the refactor steps, runs no test-change review, and passes', async () => {
		const { dir, driver, invocations, config } = await setupMoveRun();

		const result = await runImplementPipeline({ cwd: dir, driver, config, loadedConfig: { config }, planPath: 'plan.md' });

		const ledgerWriter = result.manifest.steps.find((step) => step.id === 'write-ledger-tests');
		const testWriter = result.manifest.steps.find((step) => step.id === 'write-tests');

		expect(result.ok).toBe(true);
		// no refactor pair, though the run was not asked to skip it: a refactor's
		// edits are not path updates, so the move check would refuse them
		expect(result.manifest.stepOrder).toStrictEqual([
			'clean-slate',
			'write-ledger-tests',
			'implement',
			'format-implement',
			'verify-implement',
			'write-tests',
			'format-tests',
			'verify-tests',
		]);
		// both writers say why they wrote nothing, and the reason is the move
		// rather than the absent ledger or an absence of source
		expect(ledgerWriter?.report).toEqual(expect.objectContaining({ skipped: expect.stringMatching(/move/i) }));
		expect(testWriter?.report).toEqual(expect.objectContaining({ skipped: expect.stringMatching(/move/i) }));
		expect(invocations.map((entry) => entry.role).filter((role) => ['test-review', 'write-ledger-tests', 'write-tests'].includes(role))).toStrictEqual([]);
	});

	test("a move-folders-and-files plan refused by the move check is repaired by the implement agent's fix turn", async () => {
		const { dir, driver, invocations, config } = await setupMoveRun({ implementIncrement: 2 });

		const result = await runImplementPipeline({ cwd: dir, driver, config, loadedConfig: { config }, planPath: 'plan.md' });

		const checkpoint = result.manifest.steps.find((step) => step.id === 'verify-implement');
		const fixPrompts = invocations.filter((entry) => entry.role === 'fix').map((entry) => entry.prompt);

		expect(result.ok).toBe(true);
		// the one repair the checkpoint spent was on the move check's refusal
		expect(checkpoint?.verification?.repairAttempts).toStrictEqual({ 'move-check': 1 });
		// and the implement agent was told which moved file carried the change no move explains
		expect(fixPrompts).toHaveLength(1);
		expect(fixPrompts[0]).toContain('src/widget/feature.js');
	});

	test("a move-folders-and-files plan's verify-tests repair goes to the implement agent, never the unit-test writer", async () => {
		const { dir, driver, invocations, config } = await setupMoveRun({ redVerifyTestsGate: true });

		const result = await runImplementPipeline({ cwd: dir, driver, config, loadedConfig: { config }, planPath: 'plan.md' });

		const repairs = invocations
			.filter((entry) => entry.role === 'fix')
			.map((entry) => ({
				repairsTheGate: entry.prompt.includes(buildRedMarker),
				briefedMoveOnly: entry.systemPrompt?.includes('# Move-folders-and-files phase') === true,
			}));

		expect(result.ok).toBe(true);
		// one feature-executor fix, handed the verify-tests gate's red, briefed as a move-folders-and-files phase
		expect(repairs).toStrictEqual([{ repairsTheGate: true, briefedMoveOnly: true }]);
		// a unit-test writer would be sent to repair a phase that must write no tests
		expect(invocations.map((entry) => entry.role)).not.toContain('write-tests');
	});
});
