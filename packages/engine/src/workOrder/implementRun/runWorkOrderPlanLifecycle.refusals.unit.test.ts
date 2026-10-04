import { existsSync, readFileSync, rmSync } from 'node:fs';
import { describe, expect, jest, test } from '@jest/globals';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/state/updateLocalWorkOrderState.ts';
import { runWorkOrderPlanLifecycle } from '#src/workOrder/implementRun/runWorkOrderPlanLifecycle.ts';
import {
	firstPlan,
	type MockedReadGitHeadCommit,
	otherMachineMarker,
	planOf,
	secondPlan,
	setupTicketPlanLifecycle,
	workOrderName,
} from '#tests/helpers/setupTicketPlanLifecycle.ts';

// Mocked Imports
// -------------------------
// Git is the one seam: a refusal for a commit git cannot name needs HEAD to be a
// value the row controls. The record, the sync sidecar and the plan's own files
// are real files in a temporary directory, because what these rows promise is
// that a refused plan leaves those bytes as they were.
const mockReadGitHeadCommit: MockedReadGitHeadCommit = jest.fn();

jest.mock('#src/common/git/readGitHeadCommit.ts', () => ({
	readGitHeadCommit: (params: { cwd: string }) => mockReadGitHeadCommit(params),
}));
// -------------------------

describe('runWorkOrderPlanLifecycle: the plans it will not build', () => {
	test('refuses a plan whose published files moved on another machine since this machine last synced them', async () => {
		const { cwd, name, recordPath, seenRunIds, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready, publishedMarker: otherMachineMarker })],
			planMarkers: {},
		});
		const before = readFileSync(recordPath, 'utf8');

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(outcome).toEqual({ refusal: expect.stringContaining(firstPlan) });
		expect(outcome).toEqual({ refusal: expect.stringContaining('lightsout work-order sync') });
		expect(seenRunIds).toStrictEqual([]);
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test('runWorkOrderPlanLifecycle: the divergence refusal spells the work-order command word', async () => {
		const { cwd, name, seenRunIds, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready, publishedMarker: otherMachineMarker })],
			planMarkers: {},
		});

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		// both halves of the remedy are one sentence: the published copy is taken
		// by name, and the local one is published over it by the bare `--keep local`
		expect(outcome).toEqual({ refusal: expect.stringContaining(`lightsout work-order sync --name ${workOrderName} --keep published`) });
		expect(outcome).toEqual({ refusal: expect.stringContaining('--keep local') });
		expect(outcome).toEqual({ refusal: expect.not.stringContaining('lightsout ticket sync') });
		expect(seenRunIds).toStrictEqual([]);
	});

	test('refuses a plan whose lower-numbered plan is not implemented without running it or changing the record', async () => {
		const { cwd, name, recordPath, seenRunIds, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			name: `${workOrderName}/${secondPlan}`,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready }), planOf({ id: secondPlan, progress: PlanProgress.Ready })],
		});
		const before = readFileSync(recordPath, 'utf8');

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(outcome).toEqual({ refusal: expect.stringContaining(firstPlan) });
		expect(seenRunIds).toStrictEqual([]);
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test('refuses to run the plan at all when the work order state cannot be read', async () => {
		const { cwd, name, recordPath, seenRunIds, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			corrupt: true,
		});
		const before = readFileSync(recordPath, 'utf8');

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		// a record nobody can read is not a legacy folder: running anyway would
		// build the plan and record nothing about it, which the ship guard would
		// later read as a plan whose implementation never began
		expect(outcome).toEqual({ refusal: expect.stringContaining('state.json') });
		expect(seenRunIds).toStrictEqual([]);
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});

	test('refuses at the locked write when the plan was excluded while this run was starting', async () => {
		const { cwd, name, seenRunIds, run, readRecord } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			onStart: async ({ cwd: checkout }) => {
				await updateLocalWorkOrderState({
					cwd: checkout,
					name: workOrderName,
					change: (current) =>
						current === undefined
							? { error: 'the row seeded a record' }
							: {
									...current,
									plans: current.plans.map((plan) => ({
										...plan,
										exclusion: { at: '2026-03-01T00:00:00.000Z', reason: 'superseded by the queue rewrite', implementationRemoved: false },
									})),
								},
				});
			},
		});

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		// the order rules are asked again inside the lock, so a record another
		// command changed since the first read decides this run rather than the
		// copy the first read saw
		expect(outcome).toEqual({ refusal: expect.stringContaining('superseded by the queue rewrite') });
		expect(seenRunIds).toStrictEqual([]);
		expect(readRecord().plans[0]?.progress).toBe('ready');
	});

	test('refuses at the locked write when the work order state was removed while this run was starting', async () => {
		const { cwd, name, recordPath, seenRunIds, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			onStart: async ({ recordPath: path }) => {
				rmSync(path);
			},
		});

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(outcome).toEqual({ refusal: expect.stringContaining(firstPlan) });
		expect(seenRunIds).toStrictEqual([]);
		expect(existsSync(recordPath)).toBe(false);
	});

	test("refuses to start when git cannot name the commit the plan's implementation starts from", async () => {
		const { cwd, name, recordPath, seenRunIds, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			head: undefined,
		});
		const before = readFileSync(recordPath, 'utf8');

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(outcome).toEqual({ refusal: expect.stringMatching(/\S/) });
		expect(seenRunIds).toStrictEqual([]);
		expect(readFileSync(recordPath, 'utf8')).toBe(before);
	});
});
