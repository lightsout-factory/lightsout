import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { DecisionSource } from '#src/contracts/plan/decisions/DecisionSource.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import { getPlanEvidence } from '#src/views/getPlanEvidence/getPlanEvidence.ts';
import { PlanWorkspaceNotFoundError } from '#src/views/PlanWorkspaceNotFoundError.ts';
import { countableFindings } from '#tests/helpers/countableFindings.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { planWorkspaceFolder } from '#tests/helpers/planWorkspaceFolder.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

// No module mocks: the view's whole job is composing records already on disk, so
// each case writes real records into a real work-order folder and reads them back.

/** The work order every case reads: its folder name and its branch alike. */
const workOrderName = 'add-search';
const planId = '001-search';
const name = `${workOrderName}/${planId}`;

/** A decisions.json row; `assumption: false` is a question asked of the user. */
const decisionRow = ({ assumption }: { assumption: boolean }) => ({
	source: DecisionSource.Grill,
	question: 'one index or two?',
	options: 'one / two',
	choice: 'one',
	rationale: 'simpler',
	assumption,
});

/**
 * A finished activity record: one plan level opened at `startedAt`, a step inside
 * it, and one harness process inside that stating `costUsd`.
 */
const activityLines = ({ startedAt, costUsd }: { startedAt: string; costUsd: number }) =>
	[
		{ kind: 'level-start', id: `${name}:plan`, level: 'plan', label: name, at: startedAt },
		{ kind: 'level-start', id: `${name}:draft`, parentId: `${name}:plan`, level: 'step', label: 'draft', at: startedAt },
		{
			kind: 'harness-process',
			levelId: `${name}:draft`,
			harness: 'claude',
			spawn: 1,
			reemit: false,
			startedAt,
			endedAt: '2026-11-01T10:30:00.000Z',
			endReason: 'completed',
			usage: { costUsd },
		},
		{ kind: 'level-end', id: `${name}:draft`, at: '2026-11-01T10:30:00.000Z', outcome: 'passed' },
		{ kind: 'level-end', id: `${name}:plan`, at: '2026-11-01T10:31:00.000Z', outcome: 'passed' },
	]
		.map((mark) => JSON.stringify(mark))
		.join('\n');

/** A finished activity record whose only harness process stated no cost. */
const unpricedActivityLines = ({ startedAt }: { startedAt: string }) =>
	[
		{ kind: 'level-start', id: `${name}:plan`, level: 'plan', label: name, at: startedAt },
		{
			kind: 'harness-process',
			levelId: `${name}:plan`,
			harness: 'claude',
			spawn: 1,
			reemit: false,
			startedAt,
			endedAt: '2026-11-01T10:30:00.000Z',
			endReason: 'completed',
			usage: { inputTokens: 10 },
		},
		{ kind: 'level-end', id: `${name}:plan`, at: '2026-11-01T10:31:00.000Z', outcome: 'passed' },
	]
		.map((mark) => JSON.stringify(mark))
		.join('\n');

/** A cleanup step's record; an unfinished one carries no `endReason`, which is how a cleanup still running reads. */
const refactorStep = ({
	status = RunStatus.Passed,
	finished = true,
	targeted,
	remaining = [],
}: {
	status?: StepRecord['status'];
	finished?: boolean;
	targeted: StandardsFinding[];
	remaining?: StandardsFinding[];
}): StepRecord => ({
	id: 'refactor',
	status,
	attempts: 1,
	report: {
		roundsUsed: 1,
		...(finished ? { endReason: 'clean' } : {}),
		remaining,
		inherited: [],
		uncertain: [],
		failures: [],
		initialReview: [],
		finalReview: [],
		targeted,
	},
});

/** A coordinator step naming the phase child that built its phase. */
const phaseStep = ({ id, childRunId }: { id: string; childRunId: string }): StepRecord => ({
	id,
	status: RunStatus.Passed,
	attempts: 1,
	report: { runId: childRunId },
});

interface SeededRun {
	manifest: Partial<RunManifest> & { runId: string };
	commands?: string;
}

interface SetupParams {
	/** The plan's decisions.json rows; no file is written when absent. */
	decisions?: { assumption: boolean }[];
	/** The plan's activity record, written verbatim; no file is written when absent. */
	activity?: string;
	/** The run the work order records as the plan's build; the plan carries no implementation when absent. */
	buildRunId?: string;
	/** The work order's `state.json`, written verbatim in place of the valid record. */
	stateText?: string;
	/** The branch's ship result; no file is written when absent. */
	shipResult?: Record<string, unknown>;
	/** Each run of the build family, filed under the plan. */
	runs?: SeededRun[];
	/** The work order record's own `shipped` stamp; absent leaves the record unshipped. */
	shipped?: { at: string; planIds: string[]; mergeCommit: string };
}

/** One plan folder, its work order's record, the branch's ship result and the build family's runs, all on disk. */
const setupPlanEvidence = async ({ decisions, activity, buildRunId, stateText, shipResult, runs = [], shipped }: SetupParams = {}) => {
	const cwd = await freshCwd();
	const planDir = planWorkspaceFolder({ cwd, name });
	const workOrderDir = join(cwd, '.lightsout', 'work-orders', workOrderName);
	const plan = {
		id: planId,
		title: 'Search',
		progress: buildRunId === undefined ? PlanProgress.Ready : PlanProgress.Implemented,
		createdAt: '2026-11-01T09:00:00.000Z',
		...(buildRunId === undefined ? {} : { implementation: { runId: buildRunId, startedAt: '2026-11-01T11:00:00.000Z', startCommit: 'abc1234' } }),
	};
	const record = {
		schemaVersion: 1,
		name: workOrderName,
		branch: workOrderName,
		mode: WorkOrderMode.SinglePlan,
		plans: [plan],
		...(shipped === undefined ? {} : { shipped }),
		history: [],
	};

	await mkdir(planDir, { recursive: true });
	await writeFile(join(planDir, 'plan.md'), '# Search', 'utf8');
	await writeFile(join(workOrderDir, 'state.json'), stateText ?? JSON.stringify(record), 'utf8');

	if (decisions !== undefined) {
		await writeFile(join(planDir, 'decisions.json'), JSON.stringify({ planName: name, decisions: decisions.map(decisionRow) }), 'utf8');
	}

	if (activity !== undefined) {
		await writeFile(join(planDir, 'activity.jsonl'), `${activity}\n`, 'utf8');
	}

	if (shipResult !== undefined) {
		await writeFile(join(workOrderDir, 'ship.json'), JSON.stringify(shipResult), 'utf8');
	}

	for (const run of runs) {
		await seedRunDir({ cwd, manifest: { planName: name, ...run.manifest }, logs: { commands: run.commands } });
	}

	return { cwd };
};

describe('getPlanEvidence', () => {
	test.each([
		{
			holding: 'a coordinator and two phase children, sha s recorded twice',
			buildRunId: 'run-coordinator',
			runs: [
				{
					manifest: {
						runId: 'run-coordinator',
						steps: [phaseStep({ id: 'phase1', childRunId: 'run-phase-one' }), phaseStep({ id: 'phase2', childRunId: 'run-phase-two' })],
						commitLines: [{ sha: 'aaaa111', added: 5, removed: 2 }],
					},
				},
				{ manifest: { runId: 'run-phase-one', parentRunId: 'run-coordinator', commitLines: [{ sha: 'aaaa111', added: 5, removed: 2 }] } },
				{ manifest: { runId: 'run-phase-two', parentRunId: 'run-coordinator', commitLines: [{ sha: 'bbbb222', added: 1, removed: 1 }] } },
			],
			expected: { added: { value: 6, provenance: 'measured' }, removed: { value: 3, provenance: 'measured' } },
		},
		{
			holding: 'a build run that recorded no commit lines',
			buildRunId: 'run-unmeasured',
			runs: [{ manifest: { runId: 'run-unmeasured' } }],
			expected: undefined,
		},
	])('getPlanEvidence: lines are summed once per commit sha across the family', async ({ buildRunId, runs, expected }) => {
		const { cwd } = await setupPlanEvidence({ buildRunId, runs });

		const evidence = await getPlanEvidence({ cwd, name });

		expect(evidence.lines).toEqual(expected);
	});

	test('getPlanEvidence: composes the headline from activity, decisions, ship and cleanup', async () => {
		const { cwd } = await setupPlanEvidence({
			decisions: [{ assumption: false }, { assumption: true }, { assumption: false }],
			activity: activityLines({ startedAt: '2026-11-01T10:00:00.000Z', costUsd: 5.5 }),
			buildRunId: 'run-build',
			shipResult: {
				status: ShipStatus.Shipped,
				branch: workOrderName,
				prNumber: 7,
				prUrl: 'https://forge.example/pr/7',
				prTitle: 'Add search',
				mergeCommit: 'cccc333',
				mergedAt: '2026-11-01T12:07:00.000Z',
				failingChecks: [],
			},
			runs: [{ manifest: { runId: 'run-build', steps: [refactorStep({ targeted: countableFindings({ count: 3, rule: 'acme/max-nesting' }) })] } }],
		});

		const evidence = await getPlanEvidence({ cwd, name });

		expect(evidence.headline).toEqual({
			startedAt: '2026-11-01T10:00:00.000Z',
			mergedAt: '2026-11-01T12:07:00.000Z',
			questionsAsked: { value: 2, provenance: 'measured' },
			recordedCostUsd: { value: 5.5, provenance: 'measured' },
			findingsFixed: { value: 3, provenance: 'measured' },
		});
	});

	test('getPlanEvidence: an unmerged plan carries its start and no merge time', async () => {
		const { cwd } = await setupPlanEvidence({ activity: activityLines({ startedAt: '2026-11-01T10:00:00.000Z', costUsd: 1 }) });

		const evidence = await getPlanEvidence({ cwd, name });

		expect({ startedAt: evidence.headline.startedAt, mergedAt: evidence.headline.mergedAt }).toEqual({
			startedAt: '2026-11-01T10:00:00.000Z',
			mergedAt: undefined,
		});
	});

	test.each([
		{
			holding: 'a build paused for a rate limit with tests, gate runs and a running cleanup recorded',
			buildRunId: 'run-paused',
			runs: [
				{
					manifest: {
						runId: 'run-paused',
						status: RunStatus.PausedRateLimit,
						currentStep: 'refactor',
						acceptanceTests: [{ criterion: 'search answers', testFile: 'src/search.unit.test.ts', testName: 'search: answers a query', gate: 'test' }],
						steps: [
							refactorStep({
								status: RunStatus.PausedRateLimit,
								finished: false,
								targeted: countableFindings({ count: 1, rule: 'acme/max-nesting' }),
								remaining: countableFindings({ count: 1, rule: 'acme/max-nesting' }),
							}),
						],
					},
					commands: `${JSON.stringify({ step: 'implement', durationMs: 1_000 })}\n`,
				},
			],
			expected: { runStatus: 'paused-rate-limit', tests: 'in-progress', checks: 'in-progress', cleanup: 'in-progress' },
		},
		{
			holding: 'a plan never built',
			buildRunId: undefined,
			runs: [],
			expected: { runStatus: undefined, tests: undefined, checks: undefined, cleanup: undefined },
		},
	])('getPlanEvidence: a paused build is shown so far and marked, an unbuilt plan has no build sections', async ({ buildRunId, runs, expected }) => {
		const { cwd } = await setupPlanEvidence({ buildRunId, runs });

		const evidence = await getPlanEvidence({ cwd, name });

		expect({
			runStatus: evidence.runStatus,
			tests: evidence.tests?.state,
			checks: evidence.checks?.state,
			cleanup: evidence.cleanup?.state,
		}).toEqual(expected);
	});

	test('getPlanEvidence: not-found for an unknown plan, a corrupt record reported as a problem', async () => {
		const { cwd } = await setupPlanEvidence();

		await expect(getPlanEvidence({ cwd, name: 'never-planned/001-plan' })).rejects.toThrow(PlanWorkspaceNotFoundError);
	});

	test('getPlanEvidence: not-found for an unknown plan, a corrupt record reported as a problem', async () => {
		const { cwd } = await setupPlanEvidence({ decisions: [{ assumption: false }], stateText: '{ not json' });

		const evidence = await getPlanEvidence({ cwd, name });

		expect({ problems: evidence.problems, plan: evidence.plan }).toEqual({
			problems: [expect.any(String)],
			plan: expect.objectContaining({ state: 'finished', questionsAsked: { value: 1, provenance: 'measured' } }),
		});
	});

	test('getPlanEvidence: with no ship result the merge time is the shipped stamp on the work order record', async () => {
		const { cwd } = await setupPlanEvidence({
			activity: activityLines({ startedAt: '2026-11-01T10:00:00.000Z', costUsd: 1 }),
			shipped: { at: '2026-11-02T08:15:00.000Z', planIds: [planId], mergeCommit: 'dddd444' },
		});

		const evidence = await getPlanEvidence({ cwd, name });

		expect(evidence.headline.mergedAt).toBe('2026-11-02T08:15:00.000Z');
	});

	test('getPlanEvidence: no reported cost and no targeted cleanup leave those headline figures absent', async () => {
		const { cwd } = await setupPlanEvidence({
			activity: unpricedActivityLines({ startedAt: '2026-11-01T10:00:00.000Z' }),
			buildRunId: 'run-uncleaned',
			runs: [{ manifest: { runId: 'run-uncleaned' } }],
		});

		const evidence = await getPlanEvidence({ cwd, name });

		expect({ recordedCostUsd: evidence.headline.recordedCostUsd, findingsFixed: evidence.headline.findingsFixed }).toStrictEqual({
			recordedCostUsd: undefined,
			findingsFixed: undefined,
		});
	});
});
