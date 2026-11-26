import { describe, expect, test } from '@jest/globals';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import type { PlanningStepRecord } from '#src/contracts/plan/progress/PlanningStepRecord.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { buildPlanningStepRows } from '#src/plan/progress/buildPlanningStepRows.ts';

/** A passed step, a running step whose process lives, a running step whose process is gone, and nothing for the rest. */
const setupPlanningSteps = () => {
	const passed: PlanningStepRecord = {
		step: PlanningStep.VerifyFacts,
		status: RunStatus.Passed,
		attempts: 2,
		pid: 4242,
		startedAt: '2026-09-10T10:00:00.000Z',
		finishedAt: '2026-09-10T10:00:30.000Z',
		durationMs: 30_000,
	};
	const liveRunning: PlanningStepRecord = {
		step: PlanningStep.Draft,
		status: RunStatus.Running,
		attempts: 1,
		pid: 4243,
		startedAt: '2026-09-10T10:01:00.000Z',
	};
	const deadRunning: PlanningStepRecord = {
		step: PlanningStep.Dedup,
		status: RunStatus.Running,
		attempts: 3,
		pid: 4244,
		startedAt: '2026-09-10T10:00:40.000Z',
	};
	const nowMs = Date.parse('2026-09-10T10:02:15.000Z');

	return { steps: [deadRunning, passed, liveRunning], live: [liveRunning], nowMs };
};

describe('buildPlanningStepRows', () => {
	test('draws one row per planning step, a live running step with its elapsed time and a dead one failed with no clock', () => {
		const { steps, live, nowMs } = setupPlanningSteps();

		const rows = buildPlanningStepRows({ steps, live, nowMs });

		expect(rows).toEqual([
			{ id: 'verify-facts', status: 'passed', attempts: 2, durationMs: 30_000 },
			{ id: 'draft', status: 'running', attempts: 1, durationMs: 75_000 },
			{ id: 'dedup', status: 'failed', attempts: 3, durationMs: undefined },
			{ id: 'grade', status: undefined, attempts: 0, durationMs: undefined },
			{ id: 'publish', status: undefined, attempts: 0, durationMs: undefined },
		]);
	});
});
