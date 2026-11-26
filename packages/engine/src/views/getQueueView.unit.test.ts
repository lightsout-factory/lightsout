import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { QueueBoard } from '#src/contracts/queue/QueueBoard.ts';
import type { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';
import type { QueueSummary } from '#src/contracts/queue/QueueSummary.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { getQueueView } from '#src/views/getQueueView.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { writeRunLockFile } from '#tests/helpers/writeRunLockFile.ts';

/** One run folder a case lays down: its manifest facts, and the queue's board and summary records when given. */
interface SeededRun {
	runId: string;
	pipeline?: PipelineKind;
	status: RunStatus;
	updatedAt: string;
	board?: Omit<QueueBoard, 'coordinatorRunId'>;
	summary?: QueueSummary;
}

/** A queue summary that finished at `finishedAt`; the printed lines are not what the view reads. */
const summaryAt = ({ finishedAt }: { finishedAt: string }): QueueSummary => ({ boardLines: [], reportLines: [], exitCode: 0, finishedAt });

/** The board tickets the lane case spreads across two lanes, in the order the board record lists them. */
const tickets = {
	shippedFirst: { identifier: 'EX-201', title: 'Settings', lane: QueueLane.Shipped, enteredAt: '2026-09-10T09:50:00.000Z' },
	parked: { identifier: 'EX-202', title: 'Import fix', lane: QueueLane.Parked, enteredAt: '2026-09-10T09:30:00.000Z', reason: 'retry needed' },
	shippedSecond: { identifier: 'EX-203', title: 'Exports', lane: QueueLane.Shipped, enteredAt: '2026-09-10T09:55:00.000Z' },
} satisfies Record<string, QueueBoardTicket>;

/**
 * A fresh checkout holding `runs` — each a real run folder with its board and
 * summary beside the manifest when given — and, when `liveRunId` is given, the
 * checkout's run lock naming that run under this live process, so that run and
 * no other reads as live.
 */
const setupQueueRepo = async ({ runs = [], liveRunId }: { runs?: SeededRun[]; liveRunId?: string } = {}) => {
	const cwd = await freshCwd();

	for (const { runId, pipeline = PipelineKind.Queue, status, updatedAt, board, summary } of runs) {
		const runDir = await seedRunDir({ cwd, manifest: { runId, pipeline, status, updatedAt } });

		if (board !== undefined) {
			await writeFile(join(runDir, 'board.json'), `${JSON.stringify({ coordinatorRunId: runId, ...board }, null, '\t')}\n`, 'utf8');
		}

		if (summary !== undefined) {
			await writeFile(join(runDir, 'summary.json'), `${JSON.stringify(summary, null, '\t')}\n`, 'utf8');
		}
	}

	if (liveRunId !== undefined) {
		writeRunLockFile({ dir: cwd, pid: process.pid, runId: liveRunId });
	}

	return { cwd };
};

describe('getQueueView', () => {
	test('answers no drain when no queue run is on disk', async () => {
		const { cwd } = await setupQueueRepo();

		const view = await getQueueView({ cwd });

		expect(view.drain).toBe(undefined);
	});

	test('picks the newest live queue run over a newer stopped or finished one', async () => {
		const { cwd } = await setupQueueRepo({
			runs: [
				{ runId: 'run-queue-live', status: RunStatus.Running, updatedAt: '2026-09-10T08:00:00.000Z' },
				{ runId: 'run-queue-stopped', status: RunStatus.Running, updatedAt: '2026-09-10T09:00:00.000Z' },
				{ runId: 'run-queue-finished', status: RunStatus.Passed, updatedAt: '2026-09-10T10:00:00.000Z' },
			],
			liveRunId: 'run-queue-live',
		});

		const view = await getQueueView({ cwd });

		expect(view.drain).toEqual(expect.objectContaining({ runId: 'run-queue-live', state: 'live' }));
	});

	test("labels a newest running queue run with no live process as stopped, timed at its board's last update", async () => {
		const { cwd } = await setupQueueRepo({
			runs: [
				{ runId: 'run-queue-older', status: RunStatus.Passed, updatedAt: '2026-09-10T07:00:00.000Z' },
				{
					runId: 'run-queue-newest',
					status: RunStatus.Running,
					updatedAt: '2026-09-10T09:00:00.000Z',
					board: { updatedAt: '2026-09-10T08:12:00.000Z', tickets: [] },
				},
			],
		});

		const view = await getQueueView({ cwd });

		expect(view.drain).toEqual(expect.objectContaining({ runId: 'run-queue-newest', state: 'stopped', at: '2026-09-10T08:12:00.000Z' }));
	});

	test("labels a finished queue run finished at its summary's finish time", async () => {
		const { cwd } = await setupQueueRepo({
			runs: [
				{
					runId: 'run-queue-done',
					status: RunStatus.Passed,
					updatedAt: '2026-09-10T09:00:00.000Z',
					board: { updatedAt: '2026-09-10T10:12:00.000Z', tickets: [] },
					summary: summaryAt({ finishedAt: '2026-09-10T11:30:00.000Z' }),
				},
			],
		});

		const view = await getQueueView({ cwd });

		expect(view.drain).toEqual(expect.objectContaining({ runId: 'run-queue-done', state: 'finished', at: '2026-09-10T11:30:00.000Z' }));
	});

	test("groups the board's tickets into one entry per lane holding tickets, in lane order", async () => {
		const { cwd } = await setupQueueRepo({
			runs: [
				{
					runId: 'run-queue-board',
					status: RunStatus.Running,
					updatedAt: '2026-09-10T09:00:00.000Z',
					board: { updatedAt: '2026-09-10T10:12:00.000Z', tickets: [tickets.shippedFirst, tickets.parked, tickets.shippedSecond] },
				},
			],
		});

		const view = await getQueueView({ cwd });

		expect(view.drain?.lanes).toStrictEqual([
			{ lane: 'parked', tickets: [tickets.parked] },
			{ lane: 'shipped', tickets: [tickets.shippedFirst, tickets.shippedSecond] },
		]);
	});

	test("answers a finished drain's state and time with no lanes when it wrote no board", async () => {
		const { cwd } = await setupQueueRepo({
			runs: [
				{
					runId: 'run-queue-boardless',
					status: RunStatus.Failed,
					updatedAt: '2026-09-10T09:00:00.000Z',
					summary: summaryAt({ finishedAt: '2026-09-10T09:05:00.000Z' }),
				},
			],
		});

		const view = await getQueueView({ cwd });

		expect(view.drain).toStrictEqual({ runId: 'run-queue-boardless', state: 'finished', at: '2026-09-10T09:05:00.000Z', lanes: [] });
	});

	test('ignores runs of every other pipeline', async () => {
		const { cwd } = await setupQueueRepo({
			runs: [
				{ runId: 'run-queue-old', status: RunStatus.Passed, updatedAt: '2026-09-10T08:00:00.000Z' },
				{ runId: 'run-impl-new', pipeline: PipelineKind.Implement, status: RunStatus.Running, updatedAt: '2026-09-10T10:00:00.000Z' },
			],
			liveRunId: 'run-impl-new',
		});

		const view = await getQueueView({ cwd });

		expect(view.drain?.runId).toBe('run-queue-old');
	});
});
