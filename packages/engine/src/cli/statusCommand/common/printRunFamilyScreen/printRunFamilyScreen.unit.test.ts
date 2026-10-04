import { describe, expect, jest, test } from '@jest/globals';
import { loadRunFamilyProgressBlock } from '#src/cli/statusCommand/common/loadRunFamilyProgressBlock.ts';
import { loadRunProgressBlock } from '#src/cli/statusCommand/common/loadRunProgressBlock/loadRunProgressBlock.ts';
import { printRunFamilyScreen } from '#src/cli/statusCommand/common/printRunFamilyScreen/printRunFamilyScreen.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

/** The one clock the screen and the expected block both read, so any duration column draws the same in each. */
const pinnedNow = Date.parse('2026-09-10T10:30:00.000Z');

const coordinatorId = 'cccc0000-coordinator';
const firstPhaseId = 'pppp1111-phase-one';
const secondPhaseId = 'qqqq2222-phase-two';
const loneRunId = 'llll3333-lone-run';

/**
 * A finished phased family on disk — a coordinator naming both of its phase
 * children on its steps, and the two children — plus the family block as the
 * real `loadRunFamilyProgressBlock` draws it for the second child, read before
 * stdout is captured so the expectation is the loader's own answer. Each
 * manifest records the config path it is given, and none when it is given none.
 */
const setupFamilyScreen = async ({ coordinatorConfigPath, phaseConfigPath }: { coordinatorConfigPath?: string; phaseConfigPath?: string } = {}) => {
	jest.spyOn(Date, 'now').mockReturnValue(pinnedNow);

	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: coordinatorId,
			pipeline: 'phases',
			configPath: coordinatorConfigPath,
			plan: 'plans/phased/overview.md',
			createdAt: '2026-09-10T10:00:00.000Z',
			updatedAt: '2026-09-10T10:20:00.000Z',
			status: RunStatus.Passed,
			currentStep: null,
			steps: [
				{ id: 'phase1.md', status: RunStatus.Passed, attempts: 1, durationMs: 300_000, report: { runId: firstPhaseId } },
				{ id: 'phase2.md', status: RunStatus.Passed, attempts: 1, durationMs: 420_000, report: { runId: secondPhaseId } },
			],
		},
	});

	for (const [runId, plan, updatedAt] of [
		[firstPhaseId, 'plans/phase-one/plan.md', '2026-09-10T10:08:00.000Z'],
		[secondPhaseId, 'plans/phase-two/plan.md', '2026-09-10T10:18:00.000Z'],
	] as const) {
		await seedRunDir({
			cwd,
			manifest: {
				runId,
				plan,
				parentRunId: coordinatorId,
				configPath: phaseConfigPath,
				createdAt: '2026-09-10T10:01:00.000Z',
				updatedAt,
				status: RunStatus.Passed,
				currentStep: null,
				steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 60_000 }],
				stepOrder: ['implement', 'test'],
			},
		});
	}

	const family = await loadRunFamilyProgressBlock({ cwd, runId: secondPhaseId });
	const { logged } = captureCommandOutput();

	return { cwd, family, logged };
};

/** One run outside any family, and its own block as `loadRunProgressBlock` draws it before stdout is captured. */
const setupLoneRun = async () => {
	jest.spyOn(Date, 'now').mockReturnValue(pinnedNow);

	const cwd = await freshCwd();

	await seedRunDir({
		cwd,
		manifest: {
			runId: loneRunId,
			createdAt: '2026-09-10T10:00:00.000Z',
			updatedAt: '2026-09-10T10:10:00.000Z',
			status: RunStatus.Failed,
			currentStep: null,
			steps: [{ id: 'implement', status: RunStatus.Failed, attempts: 2, durationMs: 160_000 }],
			stepOrder: ['implement', 'format'],
		},
	});

	const block = await loadRunProgressBlock({ cwd, runId: loneRunId });
	const { logged } = captureCommandOutput();

	return { cwd, block, logged };
};

describe('printRunFamilyScreen', () => {
	test("prints a blank line and the family screen, and returns the root's progress", async () => {
		const { cwd, family, logged } = await setupFamilyScreen();

		const progress = await printRunFamilyScreen({ cwd, runId: secondPhaseId });

		expect({ logged, progress, rootRunId: progress.runId }).toStrictEqual({
			logged: ['', ...family.lines],
			progress: family.progress,
			rootRunId: coordinatorId,
		});
		await expect(printRunFamilyScreen({ cwd, runId: 'ghost-run-id' })).rejects.toThrow(RunNotFoundError);
	});

	test('a run outside any family is appended as its own block alone, with nothing that clears the screen', async () => {
		const { cwd, block, logged } = await setupLoneRun();

		const progress = await printRunFamilyScreen({ cwd, runId: loneRunId });

		expect({ logged, progress }).toStrictEqual({ logged: ['', ...block.lines], progress: block.progress });
		// a frame relayed into a chat transcript must leave the frames before it readable
		expect(logged.some((line) => line.includes(String.fromCharCode(27)))).toBe(false);
	});

	test("ends the screen with the family root's recorded config path as one config line", async () => {
		const { cwd, family, logged } = await setupFamilyScreen({
			coordinatorConfigPath: '/repo/lightsout.config.json',
			phaseConfigPath: '/repo/worktrees/phase-two/lightsout.config.json',
		});

		const progress = await printRunFamilyScreen({ cwd, runId: secondPhaseId });

		expect({ logged, progress, rootRunId: progress.runId, configPath: progress.configPath }).toStrictEqual({
			logged: ['', ...family.lines, '  config: /repo/lightsout.config.json'],
			progress: family.progress,
			rootRunId: coordinatorId,
			configPath: '/repo/lightsout.config.json',
		});
	});

	test('prints no config line for a run that recorded no config path, rather than claiming the checkout has none', async () => {
		const { cwd, block, logged } = await setupLoneRun();

		await printRunFamilyScreen({ cwd, runId: loneRunId });

		expect({ logged, printsConfigLine: logged.some((line) => line.startsWith('  config:')) }).toStrictEqual({
			logged: ['', ...block.lines],
			printsConfigLine: false,
		});
	});
});
