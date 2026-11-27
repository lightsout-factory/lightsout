import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { buildShipSection } from '#src/views/getPlanEvidence/buildShipSection.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

/** The work order every case reads, its folder name and its branch alike. */
const branch = 'lo-16-ship-evidence';

/**
 * Still going: no end stamp, and the recorded pid is this test process, so it
 * reads as live. No step is running, so no row's duration depends on the clock.
 */
const liveProgress: ShippingProgress = {
	branch,
	attempt: 1,
	maxAttempts: 3,
	pid: process.pid,
	startedAt: '2026-09-10T12:00:00.000Z',
	updatedAt: '2026-09-10T12:07:00.000Z',
	steps: [
		{ id: ShippingStepId.Integrate, status: RunStatus.Passed, startedAt: '2026-09-10T12:00:00.000Z', durationMs: 30_000 },
		{ id: ShippingStepId.Push, status: RunStatus.Passed, startedAt: '2026-09-10T12:00:30.000Z', durationMs: 10_000 },
		{ id: ShippingStepId.PullRequest, status: RunStatus.Passed, startedAt: '2026-09-10T12:00:40.000Z', durationMs: 5_000 },
		{ id: ShippingStepId.Checks, status: RunStatus.Passed, startedAt: '2026-09-10T12:00:45.000Z', durationMs: 360_000 },
		{ id: ShippingStepId.Merge, status: RunStatus.Passed, startedAt: '2026-09-10T12:06:45.000Z', durationMs: 4_000 },
		{ id: ShippingStepId.Sync, status: RunStatus.Pending },
	],
};

const shippedResult = {
	status: ShipStatus.Shipped,
	branch,
	ticketRef: 'lo-16',
	prNumber: 42,
	prUrl: 'https://forge.example/acme/demo/pull/42',
	prTitle: 'LO-16: show the evidence',
	mergeCommit: 'abc1234',
	mergedAt: '2026-09-10T12:07:00.000Z',
	failingChecks: [],
};

/**
 * A checkout whose work order claims the branch, its folder holding a ship
 * result and a shipping-progress file only when a body is given for each.
 */
const setupShipRecords = async ({ shipResultBody, progressBody }: { shipResultBody?: string; progressBody?: string }) => {
	const cwd = await freshCwd();
	const folder = join(cwd, '.lightsout', 'work-orders', branch);

	seedWorkOrderRecord({ cwd, name: branch });

	if (shipResultBody !== undefined) {
		await writeFile(join(folder, 'ship.json'), shipResultBody, 'utf8');
	}

	if (progressBody !== undefined) {
		await writeFile(join(folder, 'ship-progress.json'), progressBody, 'utf8');
	}

	return { cwd };
};

describe('buildShipSection', () => {
	test.each([
		{
			records: { shipResultBody: JSON.stringify(shippedResult), progressBody: JSON.stringify(liveProgress) },
			expected: {
				section: {
					state: 'in-progress',
					result: expect.objectContaining({
						status: 'shipped',
						prUrl: 'https://forge.example/acme/demo/pull/42',
						mergedAt: '2026-09-10T12:07:00.000Z',
						failingChecks: [],
						provenance: 'measured',
					}),
					steps: [
						{ id: 'integrate', status: 'passed', durationMs: 30_000, provenance: 'measured' },
						{ id: 'push', status: 'passed', durationMs: 10_000, provenance: 'measured' },
						{ id: 'pull-request', status: 'passed', durationMs: 5_000, provenance: 'measured' },
						{ id: 'checks', status: 'passed', durationMs: 360_000, provenance: 'measured' },
						{ id: 'merge', status: 'passed', durationMs: 4_000, provenance: 'measured' },
						{ id: 'sync', status: undefined, durationMs: undefined, provenance: 'measured' },
					],
				},
				problems: [],
			},
		},
		{
			records: {},
			expected: { section: undefined, problems: [] },
		},
		{
			records: { progressBody: 'not json at all' },
			expected: expect.objectContaining({ problems: [expect.any(String)] }),
		},
	])('buildShipSection: result and steps from the ship records, absent when never shipped, an unreadable record named', async ({ records, expected }) => {
		const { cwd } = await setupShipRecords(records);

		const answer = await buildShipSection({ cwd, branch });

		expect(answer).toEqual(expected);
	});

	test('buildShipSection: a ship result with no shipping progress is finished and lists no step', async () => {
		const { cwd } = await setupShipRecords({ shipResultBody: JSON.stringify(shippedResult) });

		const answer = await buildShipSection({ cwd, branch });

		expect(answer).toEqual({
			section: {
				state: 'finished',
				result: {
					status: 'shipped',
					prUrl: 'https://forge.example/acme/demo/pull/42',
					mergedAt: '2026-09-10T12:07:00.000Z',
					failingChecks: [],
					provenance: 'measured',
				},
				steps: [],
			},
			problems: [],
		});
	});

	test('buildShipSection: an ended shipping progress with no result is finished, its steps listed', async () => {
		const endedProgress: ShippingProgress = {
			...liveProgress,
			endedAt: '2026-09-10T12:07:30.000Z',
			steps: [{ id: ShippingStepId.Integrate, status: RunStatus.Failed, startedAt: '2026-09-10T12:00:00.000Z', durationMs: 30_000 }],
		};
		const { cwd } = await setupShipRecords({ progressBody: JSON.stringify(endedProgress) });

		const answer = await buildShipSection({ cwd, branch });

		expect(answer).toEqual({
			section: {
				state: 'finished',
				result: undefined,
				steps: [
					{ id: 'integrate', status: 'failed', durationMs: 30_000, provenance: 'measured' },
					{ id: 'push', status: undefined, durationMs: undefined, provenance: 'measured' },
					{ id: 'pull-request', status: undefined, durationMs: undefined, provenance: 'measured' },
					{ id: 'checks', status: undefined, durationMs: undefined, provenance: 'measured' },
					{ id: 'merge', status: undefined, durationMs: undefined, provenance: 'measured' },
					{ id: 'sync', status: undefined, durationMs: undefined, provenance: 'measured' },
				],
			},
			problems: [],
		});
	});
});
