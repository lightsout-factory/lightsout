import { describe, expect, test } from '@jest/globals';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import { buildShippingStepRows } from '#src/ship/progress/buildShippingStepRows.ts';

/** The one clock reading every case hands in. */
const nowMs = Date.parse('2026-09-10T10:12:30.000Z');

/** A step no record entry reaches, or one the record holds at pending: no status, no attempts, no clock. */
const notRun = (id: string) => ({ id, status: undefined, attempts: 0, durationMs: undefined });

/**
 * A record with integrate passed in 40 seconds, push running since 90 seconds
 * before `nowMs`, pull-request pending, and checks, merge and sync absent.
 * `pushStarted: false` leaves push running with no recorded start.
 */
const setupShippingProgress = ({ withRecord = true, pushStarted = true }: { withRecord?: boolean; pushStarted?: boolean } = {}) => {
	const progress: ShippingProgress = {
		branch: 'lo-7-ship',
		attempt: 1,
		maxAttempts: 3,
		pid: 4242,
		startedAt: '2026-09-10T10:05:00.000Z',
		updatedAt: '2026-09-10T10:11:00.000Z',
		steps: [
			{ id: ShippingStepId.Integrate, status: RunStatus.Passed, startedAt: '2026-09-10T10:10:20.000Z', durationMs: 40_000 },
			{ id: ShippingStepId.Push, status: RunStatus.Running, ...(pushStarted ? { startedAt: '2026-09-10T10:11:00.000Z' } : {}) },
			{ id: ShippingStepId.PullRequest, status: RunStatus.Pending },
		],
	};

	return { progress: withRecord ? progress : undefined };
};

describe('buildShippingStepRows', () => {
	test.each([
		{
			withRecord: true,
			live: true,
			expected: [
				{ id: 'integrate', status: 'passed', attempts: 1, durationMs: 40_000 },
				{ id: 'push', status: 'running', attempts: 1, durationMs: 90_000 },
				notRun('pull-request'),
				notRun('checks'),
				notRun('merge'),
				notRun('sync'),
			],
		},
		{
			withRecord: true,
			live: false,
			expected: [
				{ id: 'integrate', status: 'passed', attempts: 1, durationMs: 40_000 },
				{ id: 'push', status: 'failed', attempts: 1, durationMs: undefined },
				notRun('pull-request'),
				notRun('checks'),
				notRun('merge'),
				notRun('sync'),
			],
		},
		{
			withRecord: false,
			live: false,
			expected: [notRun('integrate'), notRun('push'), notRun('pull-request'), notRun('checks'), notRun('merge'), notRun('sync')],
		},
	])('draws one row per shipping step, a running step live or failed by its process and a pending step as not run', ({ withRecord, live, expected }) => {
		const { progress } = setupShippingProgress({ withRecord });

		const rows = buildShippingStepRows({ progress, live, nowMs });

		expect(rows).toEqual(expected);
	});

	test('draws a live running step that recorded no start running with no duration', () => {
		const { progress } = setupShippingProgress({ pushStarted: false });

		const rows = buildShippingStepRows({ progress, live: true, nowMs });

		expect(rows[1]).toEqual({ id: 'push', status: 'running', attempts: 1, durationMs: undefined });
	});
});
