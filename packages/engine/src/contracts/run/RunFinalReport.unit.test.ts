import { describe, expect, test } from '@jest/globals';
import { RunFinalReport } from '#src/contracts/run/RunFinalReport.ts';

/** A report.json as a command saves it, beside records whose exit code is not a whole number. */
const setupReport = () => {
	const saved = {
		lines: ['', 'Run abcd1234 passed', '', 'Run failed: gate test'],
		exitCode: 1,
		finishedAt: '2026-09-28T10:30:00.000Z',
	};
	const fractionalExitCode = { ...saved, exitCode: 1.5 };
	const missingExitCode = { lines: saved.lines, finishedAt: saved.finishedAt };

	return { saved, fractionalExitCode, missingExitCode };
};

describe('RunFinalReport', () => {
	test('parses a saved report and refuses one without a whole-number exit code', () => {
		const { saved, fractionalExitCode, missingExitCode } = setupReport();

		const parsed = {
			saved: RunFinalReport.safeParse(saved),
			fractionalExitCode: RunFinalReport.safeParse(fractionalExitCode),
			missingExitCode: RunFinalReport.safeParse(missingExitCode),
		};

		// the saved lines are what status prints back later, and the exit code is the
		// one the process ended with — a fraction or a gap is no code a process exits with
		expect({
			saved: parsed.saved.data,
			fractionalExitCodeAccepted: parsed.fractionalExitCode.success,
			missingExitCodeAccepted: parsed.missingExitCode.success,
		}).toStrictEqual({
			saved: {
				lines: ['', 'Run abcd1234 passed', '', 'Run failed: gate test'],
				exitCode: 1,
				finishedAt: '2026-09-28T10:30:00.000Z',
			},
			fractionalExitCodeAccepted: false,
			missingExitCodeAccepted: false,
		});
	});
});
