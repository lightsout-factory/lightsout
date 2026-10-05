import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { queueCommand } from '#src/cli/queueCommand.ts';
import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { QueueDrainReport } from '#src/common/types/QueueDrainReport.ts';
import type { QueueSettings } from '#src/common/types/QueueSettings.ts';
import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { WorkOrderRunOutcome } from '#src/common/types/WorkOrderRunOutcome.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { expectDefined } from '#tests/helpers/expectDefined.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { trackerSettingsFixture } from '#tests/helpers/trackerSettingsFixture.ts';

/**
 * The summary a finished drain saves beside its run — the board, the report and
 * the exit code it printed — and what happens when there is no run to save it in
 * or the save itself fails.
 *
 * A sibling of `queueCommand.report.unit.test.ts`: that file reads what the
 * command prints, while every case here reads what it leaves on disk.
 */

// Mocked Imports
// -------------------------
// The drain spawns harnesses and talks to a tracker — the queue module's entry
// point, covered by its own tests. What a report amounts to on screen is
// observable with the drain stubbed.
type RunQueueParams = Parameters<typeof import('#src/queue/runQueue/runQueue.ts').runQueue>[0];
const mockResolveQueueSettings = jest.fn<() => QueueSettings | QueueFailure>();
const mockResolveTrackerSettings = jest.fn<() => TrackerSettings | TrackerFailure>();
const mockRunQueue = jest.fn<(params: RunQueueParams) => Promise<QueueDrainReport | QueueFailure>>();
const mockRelayClosed = jest.fn<() => void>();
const mockEmptyRelayMailbox = jest.fn<(params: { directory: string }) => Promise<void>>();

/**
 * A relay constructor whose instances only record that they were closed. A
 * function declaration, so it is already in scope when the hoisted factories
 * below run, before this module's own `const` bindings are initialised.
 */
function mockRecordingRelay() {
	return class {
		close() {
			mockRelayClosed();
		}
	};
}

jest.mock('#src/queue/startup/resolveQueueSettings/resolveQueueSettings.ts', () => ({ resolveQueueSettings: () => mockResolveQueueSettings() }));
jest.mock('#src/queue/runQueue/runQueue.ts', () => ({ runQueue: (params: RunQueueParams) => mockRunQueue(params) }));
jest.mock('#src/queue/relay/emptyRelayMailbox.ts', () => ({ emptyRelayMailbox: (params: { directory: string }) => mockEmptyRelayMailbox(params) }));
jest.mock('#src/queue/relay/TerminalQuestionRelay.ts', () => ({ TerminalQuestionRelay: mockRecordingRelay() }));
jest.mock('#src/queue/relay/FileQuestionRelay.ts', () => ({ FileQuestionRelay: mockRecordingRelay() }));
jest.mock('#src/ticketTracker/resolveTrackerSettings.ts', () => ({ resolveTrackerSettings: () => mockResolveTrackerSettings() }));
// -------------------------

const settings = queueSettingsFixture();
const trackerSettings = trackerSettingsFixture();

/** One drain outcome for one ticket. `reconciliationFailure` rides beside a shipped one, never instead of it. */
const outcomeOf = ({ ready, error, reconciliationFailure }: { ready: boolean; error?: string; reconciliationFailure?: string }): WorkOrderRunOutcome => ({
	ticket: {
		id: 'id-70',
		identifier: 'LO-70',
		title: 'Drain the backlog',
		url: 'https://linear.app/lightsout/issue/LO-70',
		description: '',
		priority: 2,
		createdAt: '2026-01-01T00:00:00.000Z',
		labels: [],
		planningStatus: PlanningStatus.NotNeeded,
		status: 'Ready to implement',
		finished: false,
		unfinishedBlockers: [],
	},
	name: 'lo-70-drain',
	branch: 'lo-70-drain',
	worktreePath: '/tmp/worktrees/lo-70-drain',
	ready,
	error,
	reconciliationFailure,
});

/** A repo whose config carries a ship block, with the drain stubbed to hand back this report. */
const setupQueueCommand = ({ report }: { report: QueueDrainReport | QueueFailure }) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ config: { ship: { 'ticket-pattern': '^(?<ticket>[a-z]+-\\d+)' } } });

	mockResolveQueueSettings.mockReturnValue(settings);
	mockResolveTrackerSettings.mockReturnValue(trackerSettings);
	mockRunQueue.mockResolvedValue(report);
	mockEmptyRelayMailbox.mockResolvedValue(undefined);

	return { context: { flags: new Map<string, string | true>(), rest: [], cwd }, cwd, ...captured };
};

/**
 * The drain stubbed as `setupQueueCommand` stubs it, but recording the queue run
 * id it was handed and — when `recordsRun`, as a drain with work does — creating
 * that run's folder. `blocksSummary` stands a directory at the summary's
 * temporary path, so the save fails for a reason other than a missing folder.
 */
const setupSavedSummary = ({
	report,
	recordsRun = true,
	blocksSummary = false,
}: {
	report: QueueDrainReport;
	recordsRun?: boolean;
	blocksSummary?: boolean;
}) => {
	const captured = setupQueueCommand({ report });
	const handedRunIds: string[] = [];
	const runDirs: string[] = [];

	mockRunQueue.mockImplementation(async (params) => {
		expectDefined(params.runId);
		handedRunIds.push(params.runId);

		if (recordsRun) {
			const runDir = seedRunFolder({ cwd: params.cwd, runId: params.runId, pipeline: 'queue' });

			if (blocksSummary) {
				mkdirSync(join(runDir, 'summary.json.tmp'));
			}

			runDirs.push(runDir);
		}

		return report;
	});

	return { ...captured, handedRunIds, runDirs };
};

/** One ticket parked on a gate failure, so the drain ends on the paused code. */
const parkedReport: QueueDrainReport = { outcomes: [outcomeOf({ ready: false, error: 'tsc: 3 errors' })], leftBehind: [] };

/** The final board's heading: the finish time is the moment the command ran, so only its shape is pinned. */
const finishedHeading = expect.stringMatching(/^Queue finished · \d{2}:\d{2}$/);
const boardHeaderRow = '| Parked | Blocked | Build Queue | Building | Ship Queue | Shipping Now | Shipped |';
const boardSeparatorRow = '| --- | --- | --- | --- | --- | --- | --- |';

describe('queueCommand', () => {
	test('saves the finished board, report and exit code in the queue run folder', async () => {
		const { context, logged, exitCodes, runDirs } = setupSavedSummary({ report: parkedReport });

		await expect(queueCommand(context)).rejects.toThrow(/process\.exit/);

		// The board ends in one blank line; the report, which holds none, is what follows it.
		const separator = logged.lastIndexOf('');
		const printedBoard = logged.slice(0, separator);
		const printedReport = logged.slice(separator + 1);
		const summary: unknown = JSON.parse(readFileSync(join(runDirs[0], 'summary.json'), 'utf8'));

		expect(printedReport).toStrictEqual(['LO-70 lo-70-drain parked: tsc: 3 errors', '  worktree: /tmp/worktrees/lo-70-drain']);
		expect(summary).toEqual({ boardLines: printedBoard, reportLines: printedReport, exitCode: 2, finishedAt: expect.any(String) });
		expect(exitCodes).toStrictEqual([2]);
	});

	test('a drain that created no run saves no summary and says nothing about it', async () => {
		const { context, cwd, logged, errors, exitCodes } = setupSavedSummary({ report: { outcomes: [], leftBehind: [] }, recordsRun: false });

		await expect(queueCommand(context)).rejects.toThrow(/process\.exit/);

		const summaries = readdirSync(cwd, { recursive: true }).filter((entry) => String(entry).includes('summary.json'));

		expect(logged).toEqual([finishedHeading, '', boardHeaderRow, boardSeparatorRow, '| — | — | — | — | — | — | — |', '']);
		expect(errors).toStrictEqual([]);
		expect(summaries).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a summary that cannot be written is one stderr line and never changes the exit code', async () => {
		const { context, errors, exitCodes, handedRunIds } = setupSavedSummary({ report: parkedReport, blocksSummary: true });

		await expect(queueCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors).toEqual([expect.stringContaining(handedRunIds[0])]);
		expect(exitCodes).toStrictEqual([2]);
	});
});
