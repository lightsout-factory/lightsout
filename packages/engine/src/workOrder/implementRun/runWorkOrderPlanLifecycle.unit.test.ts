import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { sha256 } from '#src/common/utils/sha256.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { runWorkOrderPlanLifecycle } from '#src/workOrder/implementRun/runWorkOrderPlanLifecycle.ts';
import {
	address,
	decisionsBody,
	firstPlan,
	headCommit,
	type MockedReadGitHeadCommit,
	manifestOf,
	otherMachineMarker,
	planBody,
	planOf,
	setupTicketPlanLifecycle,
	startCommit,
	workOrderName,
} from '#tests/helpers/setupTicketPlanLifecycle.ts';

// Mocked Imports
// -------------------------
// Git is the one seam. The commit a plan's implementation starts from is read
// out of the checkout, and the rows below need it to be a value they can name
// and to have moved since an earlier run failed. Everything else — the record,
// the sync sidecar and the plan's own files — is a real file in a temporary
// directory, because what this helper promises is about which bytes reach disk
// and when.
const mockReadGitHeadCommit: MockedReadGitHeadCommit = jest.fn();

jest.mock('#src/common/git/readGitHeadCommit.ts', () => ({
	readGitHeadCommit: (params: { cwd: string }) => mockReadGitHeadCommit(params),
}));
// -------------------------

/**
 * A ticket whose sidecar inside its OWN folder agrees with the record, and a
 * stale sidecar in the pre-layout plans folder that names no marker at all.
 *
 * The two answers are opposite on purpose: read from the work order's folder the
 * plan is in step and the run goes ahead, and read from the pre-layout folder
 * the plan looks published elsewhere and the lifecycle refuses before the
 * pipeline is ever called.
 */
const setupTicketFolderSyncState = async () => {
	const context = await setupTicketPlanLifecycle({
		mockReadGitHeadCommit,
		plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready, publishedMarker: otherMachineMarker })],
		manifestPlan: `.lightsout/work-orders/${workOrderName}/plans/${firstPlan}/plan.md`,
	});
	const workOrderFolder = join(context.cwd, '.lightsout', 'work-orders', workOrderName);
	const preLayoutFolder = join(context.cwd, '.lightsout', 'plans', workOrderName);

	mkdirSync(workOrderFolder, { recursive: true });
	writeFileSync(join(workOrderFolder, 'state-sync.json'), JSON.stringify({ schemaVersion: 1, planMarkers: { [firstPlan]: otherMachineMarker } }));
	mkdirSync(preLayoutFolder, { recursive: true });
	writeFileSync(join(preLayoutFolder, 'state-sync.json'), JSON.stringify({ schemaVersion: 1, planMarkers: {} }));

	return {
		...context,
		readTicketFolderRecord: () => JSON.parse(readFileSync(join(workOrderFolder, 'state.json'), 'utf8')) as WorkOrderState,
	};
};

/**
 * A work order holding one ready plan, asked for by its plan address, with a
 * whole plan in the folder so the run is a whole-plan pass.
 *
 * The state file is read back from the work order's own folder rather than from
 * a path the fixture hands out, so the row states the file name itself.
 */
const setupWholePlanRun = async () => {
	const context = await setupTicketPlanLifecycle({
		mockReadGitHeadCommit,
		plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
	});
	const workOrderFolder = await workOrderFolderDir({ cwd: context.cwd, name: workOrderName });

	return {
		...context,
		readStateFile: () => JSON.parse(readFileSync(join(workOrderFolder, 'state.json'), 'utf8')) as WorkOrderState,
		hasLegacyRecordFile: () => existsSync(join(workOrderFolder, 'ticket.json')),
	};
};

describe('runWorkOrderPlanLifecycle: what the run leaves on the plan', () => {
	test('runWorkOrderPlanLifecycle: records progress around the run in state.json', async () => {
		const { cwd, name, run, recordsAtRunStart, readStateFile, hasLegacyRecordFile } = await setupWholePlanRun();

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(outcome).toEqual({ result: expect.objectContaining({ ok: true }) });
		expect({
			atRunStart: recordsAtRunStart[0]?.plans[0]?.progress,
			afterTheRun: readStateFile().plans[0]?.progress,
			legacyRecordFileWritten: hasLegacyRecordFile(),
		}).toStrictEqual({
			atRunStart: 'implementing',
			afterTheRun: 'implemented',
			legacyRecordFileWritten: false,
		});
	});

	test("runs a legacy plan folder's pipeline unchanged and writes no work order state", async () => {
		const { cwd, name, recordPath, seenRunIds, run } = await setupTicketPlanLifecycle({ mockReadGitHeadCommit, name: workOrderName });

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(seenRunIds).toEqual([expect.stringMatching(/\S/)]);
		expect(outcome).toEqual({
			result: { ok: true, manifest: manifestOf({ name: workOrderName, runId: seenRunIds[0], status: RunStatus.Passed }) },
		});
		expect(existsSync(recordPath)).toBe(false);
	});

	test('runs a plan address whose ticket has no record unchanged and creates none', async () => {
		const { cwd, name, recordPath, seenRunIds, run } = await setupTicketPlanLifecycle({ mockReadGitHeadCommit });

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(seenRunIds).toEqual([expect.stringMatching(/\S/)]);
		expect(outcome).toEqual({ result: { ok: true, manifest: manifestOf({ name: address, runId: seenRunIds[0], status: RunStatus.Passed }) } });
		expect(existsSync(recordPath)).toBe(false);
	});

	test('records the plan implementing under the run id it hands the pipeline, with the start time and HEAD commit, before the pipeline runs', async () => {
		const { cwd, name, seenRunIds, recordsAtRunStart, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
		});

		await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(recordsAtRunStart[0]?.plans[0]).toEqual({
			id: firstPlan,
			title: `plan ${firstPlan}`,
			progress: 'implementing',
			createdAt: '2026-01-01T00:00:00.000Z',
			implementation: { runId: seenRunIds[0], startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), startCommit: headCommit },
		});
	});

	test('records a passed run implemented with its finish time and a snapshot of every durable plan file', async () => {
		const { cwd, name, run, readRecord } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
		});

		await runWorkOrderPlanLifecycle({ cwd, name, run });
		const record = readRecord();

		expect(record.plans[0]).toEqual(
			expect.objectContaining({
				progress: 'implemented',
				implementation: expect.objectContaining({
					finishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
					snapshot: [
						{ name: 'plan.md', sha256: sha256({ content: planBody }) },
						{ name: 'decisions.json', sha256: sha256({ content: decisionsBody }) },
					],
				}),
			}),
		);
	});

	test('leaves the plan implementing when only one phase file of it ran and passed', async () => {
		const { cwd, name, seenRunIds, run, readRecord } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			folder: 'phased',
			manifestPlan: `.lightsout/work-orders/${address}/plans/phase1-lifecycle.md`,
		});

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });
		const record = readRecord();

		expect(outcome).toEqual({ result: expect.objectContaining({ ok: true }), note: expect.stringMatching(/\S/) });
		expect(outcome).toEqual({ result: expect.anything(), note: expect.not.stringMatching(/unfinished/i) });
		expect(record.plans[0]?.progress).toBe('implementing');
		expect(record.plans[0]?.implementation).toEqual({
			runId: seenRunIds[0],
			startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
			startCommit: headCommit,
		});
	});

	test('records a failed or an escalated run as failed without a finish time or snapshot', async () => {
		const failed = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			status: RunStatus.Failed,
		});
		const escalated = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			status: RunStatus.Escalated,
		});

		await runWorkOrderPlanLifecycle({ cwd: failed.cwd, name: failed.name, run: failed.run });
		await runWorkOrderPlanLifecycle({ cwd: escalated.cwd, name: escalated.name, run: escalated.run });

		expect(failed.readRecord().plans[0]).toEqual(
			expect.objectContaining({
				progress: 'failed',
				implementation: { runId: failed.seenRunIds[0], startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), startCommit: headCommit },
			}),
		);
		expect(escalated.readRecord().plans[0]).toEqual(
			expect.objectContaining({
				progress: 'failed',
				implementation: { runId: escalated.seenRunIds[0], startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), startCommit: headCommit },
			}),
		);
	});

	test('leaves the plan implementing when the run pauses', async () => {
		const { cwd, name, seenRunIds, run, readRecord } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			status: RunStatus.PausedRateLimit,
		});

		await runWorkOrderPlanLifecycle({ cwd, name, run });
		const record = readRecord();

		expect(record.plans[0]).toEqual(
			expect.objectContaining({
				progress: 'implementing',
				implementation: { runId: seenRunIds[0], startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), startCommit: headCommit },
			}),
		);
	});

	test("keeps the recorded start time and commit when a failed plan's implementation is resumed", async () => {
		const { cwd, name, seenRunIds, recordsAtRunStart, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [
				planOf({
					id: firstPlan,
					progress: PlanProgress.Failed,
					implementation: { runId: 'run-earlier', startedAt: '2026-02-01T00:00:00.000Z', startCommit },
				}),
			],
		});

		await runWorkOrderPlanLifecycle({ cwd, name, resumeRunId: 'run-earlier', run });

		expect(seenRunIds).toStrictEqual(['run-earlier']);
		expect(recordsAtRunStart[0]?.plans[0]).toEqual(
			expect.objectContaining({
				progress: 'implementing',
				implementation: { runId: 'run-earlier', startedAt: '2026-02-01T00:00:00.000Z', startCommit },
			}),
		);
	});

	test("returns the run's result with a record error when the work order state is gone once the run ends", async () => {
		const { cwd, name, seenRunIds, run } = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })],
			onRun: ({ recordPath }) => rmSync(recordPath),
		});

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });

		expect(outcome).toEqual({
			result: { ok: true, manifest: manifestOf({ name: address, runId: seenRunIds[0], status: RunStatus.Passed }) },
			recordError: expect.stringMatching(/\S/),
		});
	});
});

describe("runWorkOrderPlanLifecycle: the folder the ticket's state is read from", () => {
	test("runWorkOrderPlanLifecycle: the ticket's sync state is read from the ticket's own folder", async () => {
		const { cwd, name, run, seenRunIds, readTicketFolderRecord } = await setupTicketFolderSyncState();

		const outcome = await runWorkOrderPlanLifecycle({ cwd, name, run });
		const record = readTicketFolderRecord();

		expect(outcome).toEqual({ result: expect.objectContaining({ ok: true }) });
		expect(seenRunIds).toEqual([expect.stringMatching(/\S/)]);
		expect(record.plans[0]).toEqual(
			expect.objectContaining({
				progress: 'implemented',
				implementation: expect.objectContaining({ runId: seenRunIds[0], startCommit: headCommit }),
			}),
		);
	});
});

describe('runWorkOrderPlanLifecycle: the id the run is created under', () => {
	test('runWorkOrderPlanLifecycle: a fresh run is created and recorded under the id its caller pre-minted', async () => {
		const preMinted = await setupTicketPlanLifecycle({ mockReadGitHeadCommit, plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })] });
		const minted = await setupTicketPlanLifecycle({ mockReadGitHeadCommit, plans: [planOf({ id: firstPlan, progress: PlanProgress.Ready })] });

		await runWorkOrderPlanLifecycle({ cwd: preMinted.cwd, name: preMinted.name, runId: 'run-pre-minted', run: preMinted.run });
		await runWorkOrderPlanLifecycle({ cwd: minted.cwd, name: minted.name, run: minted.run });

		// a detached launch's parent has already printed this id, so the run, the
		// plan's implementation and that line must all name the same one
		expect({
			seen: preMinted.seenRunIds,
			atRunStart: preMinted.recordsAtRunStart[0]?.plans[0],
		}).toEqual({
			seen: ['run-pre-minted'],
			atRunStart: expect.objectContaining({
				progress: 'implementing',
				implementation: { runId: 'run-pre-minted', startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), startCommit: headCommit },
			}),
		});
		expect(minted.seenRunIds).toEqual([expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)]);
		expect(minted.recordsAtRunStart[0]?.plans[0]?.implementation?.runId).toBe(minted.seenRunIds[0]);
	});

	test('runWorkOrderPlanLifecycle: a resume id wins over a pre-minted one, and the pre-minted id reaches the run on every path', async () => {
		const resumed = await setupTicketPlanLifecycle({
			mockReadGitHeadCommit,
			plans: [
				planOf({
					id: firstPlan,
					progress: PlanProgress.Failed,
					implementation: { runId: 'run-earlier', startedAt: '2026-02-01T00:00:00.000Z', startCommit },
				}),
			],
		});
		const noRecord = await setupTicketPlanLifecycle({ mockReadGitHeadCommit });
		const outsidePlans = await setupTicketPlanLifecycle({ mockReadGitHeadCommit });

		await runWorkOrderPlanLifecycle({ cwd: resumed.cwd, name: resumed.name, resumeRunId: 'run-earlier', runId: 'run-pre-minted', run: resumed.run });
		await runWorkOrderPlanLifecycle({ cwd: noRecord.cwd, name: noRecord.name, runId: 'run-pre-minted', run: noRecord.run });
		await runWorkOrderPlanLifecycle({ cwd: outsidePlans.cwd, name: undefined, runId: 'run-pre-minted', run: outsidePlans.run });

		expect({
			resumed: resumed.seenRunIds,
			resumedRecordedUnder: resumed.recordsAtRunStart[0]?.plans[0]?.implementation?.runId,
			noRecord: noRecord.seenRunIds,
			outsidePlans: outsidePlans.seenRunIds,
		}).toStrictEqual({
			resumed: ['run-earlier'],
			resumedRecordedUnder: 'run-earlier',
			noRecord: ['run-pre-minted'],
			outsidePlans: ['run-pre-minted'],
		});
	});
});
