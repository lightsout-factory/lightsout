import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { printRunFinalReport } from '#src/cli/internal/common/runStatus/printRunFinalReport.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

const runId = 'rrrr0000-implement-run';
const coordinatorId = 'cccc0000-coordinator';
const phaseChildId = 'pppp1111-phase-one';

/** The report a command saved when it ended the run — opening with its own blank line, closing with the run's error. */
const savedLines = ['', 'Run:      rrrr0000', 'Status:   passed', 'Branch:   lo-1-show-the-report', '', 'a line the error left'];

/** Writes report.json by hand, so the fixture states the file the reader expects rather than borrowing the writer. */
const writeSavedReport = async ({ runDir, lines }: { runDir: string; lines: string[] }) => {
	await writeFile(join(runDir, 'report.json'), JSON.stringify({ lines, exitCode: 0, finishedAt: '2026-10-01T09:30:00.000Z' }), 'utf8');
};

/** One implement run on disk in the given status, with or without a report an earlier command saved in its folder. */
const setupRun = async ({ status, saved = true }: { status: RunStatus; saved?: boolean }) => {
	const cwd = await freshCwd();
	const runDir = await seedRunDir({ cwd, manifest: { runId, status } });

	if (saved) {
		await writeSavedReport({ runDir, lines: savedLines });
	}

	const { logged, errors } = captureCommandOutput();

	return { cwd, logged, errors };
};

/** A phased family on disk — the coordinator in the given status holding the saved report, and its passed first phase. */
const setupPhasedFamily = async ({ rootStatus }: { rootStatus: RunStatus }) => {
	const cwd = await freshCwd();
	const coordinatorDir = await seedRunDir({
		cwd,
		manifest: {
			runId: coordinatorId,
			pipeline: 'phases',
			plan: 'plans/phased/overview.md',
			status: rootStatus,
			currentStep: rootStatus === RunStatus.Running ? 'phase2.md' : null,
			steps: [
				{ id: 'phase1.md', status: RunStatus.Passed, attempts: 1, report: { runId: phaseChildId } },
				{ id: 'phase2.md', status: rootStatus, attempts: 1 },
			],
		},
	});

	await seedRunDir({ cwd, manifest: { runId: phaseChildId, parentRunId: coordinatorId, status: RunStatus.Passed } });
	await writeSavedReport({ runDir: coordinatorDir, lines: savedLines });

	const { logged } = captureCommandOutput();

	return { cwd, logged };
};

describe('printRunFinalReport', () => {
	test("prints a finished run's saved report exactly as it was saved", async () => {
		const { cwd, logged } = await setupRun({ status: RunStatus.Passed });

		await printRunFinalReport({ cwd, runId });

		expect(logged).toStrictEqual(savedLines);
	});

	test('prints nothing for a run that is going again, whatever an earlier command saved', async () => {
		const { cwd, logged, errors } = await setupRun({ status: RunStatus.Running });

		await printRunFinalReport({ cwd, runId });

		expect({ logged, errors }).toStrictEqual({ logged: [], errors: [] });
	});

	test.each([
		{ rootStatus: RunStatus.Passed, expected: savedLines },
		{ rootStatus: RunStatus.Running, expected: [] },
	])("a phase child shows its family root's report only once the root has finished", async ({ rootStatus, expected }) => {
		const { cwd, logged } = await setupPhasedFamily({ rootStatus });

		await printRunFinalReport({ cwd, runId: phaseChildId });

		expect(logged).toStrictEqual(expected);
	});

	test('prints nothing for a finished run that saved no report', async () => {
		const { cwd, logged, errors } = await setupRun({ status: RunStatus.Passed, saved: false });

		const printed = printRunFinalReport({ cwd, runId });

		await expect(printed).resolves.toBeUndefined();
		expect({ logged, errors }).toStrictEqual({ logged: [], errors: [] });
	});
});
