import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { loadShippingProgressBlock } from '#src/cli/statusCommand/common/loadShippingProgressBlock.ts';
import { loadActiveTicketBlock } from '#src/cli/statusCommand/printQueueStatus/loadActiveTicketBlock.ts';
import type { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

// The ticket the ship lane holds: which shipping record its block draws, and
// the notice it gets when that record is stale or its worktree is gone.

/** The one clock the binder and the expected blocks both read, so a live running row ticks to the same value in each. */
const pinnedNow = Date.parse('2026-09-10T10:30:00.000Z');

/** The branch the ticket builds and ships. */
const branch = 'lo-9-board-links';

/** When the Shipping Now ticket entered the ship lane. */
const enteredShippingAt = '2026-09-10T10:20:00.000Z';

interface SeededRun {
	runId: string;
	plan: string;
	createdAt: string;
	updatedAt: string;
	status: RunStatus;
}

/** An engine run beside the ship, which a run binder would pick over the shipping record. */
const buildRun: SeededRun = {
	runId: 'bbbb2222-run-b',
	plan: 'plans/run-b/plan.md',
	createdAt: '2026-09-10T10:05:00.000Z',
	updatedAt: '2026-09-10T10:10:00.000Z',
	status: RunStatus.Passed,
};

const manifestOf = ({ runId, plan, createdAt, updatedAt, status }: SeededRun): Partial<RunManifest> & { runId: string } => ({
	runId,
	plan,
	createdAt,
	updatedAt,
	status,
	currentStep: status === RunStatus.Running ? 'implement' : null,
	steps: [{ id: 'implement', status, attempts: 1, durationMs: 60_000 }],
	stepOrder: ['implement', 'test'],
});

const ticketOf = (overrides: Partial<QueueBoardTicket> & Pick<QueueBoardTicket, 'lane' | 'enteredAt'>): QueueBoardTicket => ({
	identifier: 'LO-9',
	title: 'Board links',
	url: 'https://linear.app/lightsout/issue/LO-9',
	branch,
	...overrides,
});

/** A live ship under this test's process, integrate passed and push running, begun at `startedAt`. */
const shippingRecord = ({ startedAt }: { startedAt: string }): ShippingProgress => ({
	branch,
	attempt: 1,
	maxAttempts: 3,
	pid: process.pid,
	startedAt,
	updatedAt: '2026-09-10T10:26:00.000Z',
	lastProgress: `pushing ${branch}`,
	steps: [
		{ id: ShippingStepId.Integrate, status: RunStatus.Passed, startedAt, durationMs: 60_000 },
		{ id: ShippingStepId.Push, status: RunStatus.Running, startedAt: '2026-09-10T10:26:00.000Z' },
	],
});

/**
 * A worktree for the ticket the ship lane holds: its shipping record begun at
 * `shipStartedAt`, filed as `ship-progress.json` in the branch's ticket folder,
 * and an engine run beside it that a run binder would pick.
 * `onDisk: false` answers a worktree path that is not there at all.
 */
const setupShippingWorktree = async ({ shipStartedAt, onDisk = true }: { shipStartedAt: string; onDisk?: boolean }) => {
	jest.spyOn(Date, 'now').mockReturnValue(pinnedNow);

	const checkout = await freshCwd();
	const worktreePath = onDisk ? checkout : join(checkout, 'removed-worktree');

	if (onDisk) {
		const workOrderFolder = join(worktreePath, '.lightsout', 'work-orders', branch);

		// The shipping record is filed in the work order whose record stores the branch.
		seedWorkOrderRecord({ cwd: worktreePath, name: branch });

		await mkdir(workOrderFolder, { recursive: true });
		await writeFile(join(workOrderFolder, 'ship-progress.json'), `${JSON.stringify(shippingRecord({ startedAt: shipStartedAt }), null, '\t')}\n`, 'utf8');
		await seedRunDir({ cwd: worktreePath, manifest: manifestOf({ ...buildRun, createdAt: '2026-09-10T10:22:00.000Z' }) });
	}

	const shippingBlock = onDisk ? await loadShippingProgressBlock({ cwd: worktreePath, branch }) : [];

	return { worktreePath, shippingBlock };
};

describe('loadActiveTicketBlock', () => {
	test('shows the shipping block for the ticket the ship lane holds', async () => {
		const { worktreePath, shippingBlock } = await setupShippingWorktree({ shipStartedAt: '2026-09-10T10:21:00.000Z' });
		const ticket = ticketOf({ lane: QueueLane.ShippingNow, enteredAt: enteredShippingAt, worktreePath });

		const lines = await loadActiveTicketBlock({ ticket });

		expect(lines).toStrictEqual(shippingBlock);
	});

	test("loadActiveTicketBlock: shows a ticket's shipping steps from the record filed in its ticket folder", async () => {
		const { worktreePath } = await setupShippingWorktree({ shipStartedAt: '2026-09-10T10:21:00.000Z' });
		const ticket = ticketOf({ lane: QueueLane.ShippingNow, enteredAt: enteredShippingAt, worktreePath });

		const lines = await loadActiveTicketBlock({ ticket });

		// The steps the record holds, rather than the every-row-unreached block a
		// missing record draws: the worktree path is handed over as the checkout,
		// and the record is read from the branch's ticket folder.
		expect(lines).toEqual(expect.arrayContaining([expect.stringMatching(/integrate\s+passed/), expect.stringMatching(/push\s+running/)]));
	});

	test('gives a one-line notice for a shipping ticket whose worktree is no longer on disk', async () => {
		const { worktreePath } = await setupShippingWorktree({ shipStartedAt: '2026-09-10T10:21:00.000Z', onDisk: false });
		const ticket = ticketOf({ lane: QueueLane.ShippingNow, enteredAt: enteredShippingAt, worktreePath });

		const lines = await loadActiveTicketBlock({ ticket });

		expect(lines).toEqual([expect.stringContaining(worktreePath)]);
	});

	test('never shows a shipping record left by an earlier ship of the same branch', async () => {
		const { worktreePath } = await setupShippingWorktree({ shipStartedAt: '2026-09-10T09:40:00.000Z' });
		const ticket = ticketOf({ lane: QueueLane.ShippingNow, enteredAt: enteredShippingAt, worktreePath });

		const lines = await loadActiveTicketBlock({ ticket });

		expect(lines).toEqual([expect.stringMatching(/shipping now/i)]);
	});
});
