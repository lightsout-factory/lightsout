import { mkdirSync } from 'node:fs';
import { describe, expect, jest, test } from '@jest/globals';
import { printQueueStatus } from '#src/cli/statusCommand/printQueueStatus/printQueueStatus.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { getQueueBoardPath } from '#src/queue/board/getQueueBoardPath.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

// Mocked Imports
// -------------------------
// `resolveQueueRun` owns a clock — it waits up to a minute for a queue run to
// take the checkout's lock — and has its own test that drives that wait. Every
// case here is about what the printer says when it has no board to draw.
interface ResolveQueueRunParams {
	cwd: string;
	runId?: string;
	wait?: boolean;
	graceMs?: number;
	pollMs?: number;
}

const mockResolveQueueRun = jest.fn<(params: ResolveQueueRunParams) => Promise<RunListing | undefined>>();

jest.mock('#src/cli/statusCommand/printQueueStatus/resolveQueueRun.ts', () => ({
	resolveQueueRun: (params: ResolveQueueRunParams) => mockResolveQueueRun(params),
}));
// -------------------------

/** The queue run whose folder every case puts on disk, holding no board. */
const queueRunId = 'run-queue-0001';

/** A run's row as the resolver answers it: a queue run still going unless a case names another. */
const runListingOf = ({
	runId = queueRunId,
	pipeline = PipelineKind.Queue,
	status = RunStatus.Running,
	live = true,
}: Partial<Pick<RunListing, 'runId' | 'pipeline' | 'status' | 'live'>> = {}): RunListing => ({
	runId,
	shortId: runId.slice(0, 8),
	pipeline,
	status,
	title: pipeline,
	plan: '',
	createdAt: '2026-09-10T08:00:00.000Z',
	updatedAt: '2026-09-10T09:00:00.000Z',
	live,
	packages: [],
	stepsPassed: 0,
	stepCount: 0,
	changedFileCount: 0,
	resumable: false,
});

/**
 * A fresh main checkout holding the queue run's folder but no board in it, the
 * resolver answering `listing`. The folder is on disk so the board path has a
 * place to point at.
 */
const setupNoBoard = async ({ listing }: { listing: RunListing | undefined }) => {
	mockResolveQueueRun.mockResolvedValue(listing);

	const cwd = await freshCwd();

	mkdirSync(runDirFor({ cwd, runId: queueRunId, pipeline: 'queue' }), { recursive: true });

	const boardPath = await getQueueBoardPath({ cwd, runId: queueRunId });

	return { cwd, boardPath, ...captureCommandOutput() };
};

describe('printQueueStatus', () => {
	test('says no queue run is going when none is found, and answers 0', async () => {
		const { cwd, logged, errors } = await setupNoBoard({ listing: undefined });

		const code = await printQueueStatus({ cwd });

		expect({ logged, errors, code }).toEqual({ logged: [expect.stringContaining(cwd)], errors: [], code: 0 });
	});

	test('names the board file when the queue run has not written one yet, and answers 0', async () => {
		const { cwd, boardPath, logged, errors } = await setupNoBoard({ listing: runListingOf() });

		const code = await printQueueStatus({ cwd });

		expect({ logged, errors, code }).toEqual({ logged: [expect.stringContaining(boardPath)], errors: [], code: 0 });
	});

	test('refuses a named run that is not a queue run with one line on stderr and answers 1', async () => {
		const { cwd, logged, errors } = await setupNoBoard({
			listing: runListingOf({ runId: 'run-impl-0002', pipeline: PipelineKind.Implement, status: RunStatus.Passed, live: false }),
		});

		const code = await printQueueStatus({ cwd, runId: 'run-impl-0002' });

		expect({ logged, errors, code }).toEqual({ logged: [], errors: [expect.stringMatching(/^(?=.*run-impl)(?=.*queue)/i)], code: 1 });
	});
});
