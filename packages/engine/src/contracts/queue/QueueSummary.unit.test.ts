import { describe, expect, test } from '@jest/globals';
import { QueueSummary } from '#src/contracts/queue/QueueSummary.ts';

const setupSummaries = () => {
	const summary = {
		boardLines: ['Queue — finished', '  LO-136  passed'],
		reportLines: ['passed: LO-136', 'parked: LO-140 (rate limit)'],
		exitCode: 2,
		finishedAt: '2026-09-10T09:30:00.000Z',
	};
	const summaryWithoutReportLines = {
		boardLines: summary.boardLines,
		exitCode: summary.exitCode,
		finishedAt: summary.finishedAt,
	};

	return { summary, summaryWithoutReportLines };
};

describe('QueueSummary', () => {
	test('parses a saved queue summary and refuses one without its report lines', () => {
		const { summary, summaryWithoutReportLines } = setupSummaries();

		const accepted = QueueSummary.safeParse(summary);
		const refused = QueueSummary.safeParse(summaryWithoutReportLines);

		expect(accepted.data).toStrictEqual({
			boardLines: ['Queue — finished', '  LO-136  passed'],
			reportLines: ['passed: LO-136', 'parked: LO-140 (rate limit)'],
			exitCode: 2,
			finishedAt: '2026-09-10T09:30:00.000Z',
		});
		expect(refused.success).toBe(false);
	});
});
