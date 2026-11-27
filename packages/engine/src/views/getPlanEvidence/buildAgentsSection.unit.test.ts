import { describe, expect, test } from '@jest/globals';
import { buildActivityTree } from '#src/activity/buildActivityTree/buildActivityTree.ts';
import type { StepSummary } from '#src/common/types/StepSummary.ts';
import type { ActivityLevelEnd } from '#src/contracts/activity/ActivityLevelEnd.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { ActivityLevelStart } from '#src/contracts/activity/ActivityLevelStart.ts';
import { ActivityMarkKind } from '#src/contracts/activity/ActivityMarkKind.ts';
import type { HarnessProcessMark } from '#src/contracts/activity/HarnessProcessMark.ts';
import { ProcessEndReason } from '#src/contracts/activity/ProcessEndReason.ts';
import { FrictionArea } from '#src/contracts/friction/FrictionArea.ts';
import { FrictionKind } from '#src/contracts/friction/FrictionEntry/FrictionKind.ts';
import type { FrictionRecord } from '#src/contracts/friction/FrictionRecord.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { buildAgentsSection } from '#src/views/getPlanEvidence/buildAgentsSection.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';
import { runProgressManifestOf } from '#tests/helpers/runProgressManifestOf.ts';

/** One level opening inside its parent. */
const levelStart = ({
	id,
	parentId,
	level,
	label,
	at,
}: {
	id: string;
	parentId?: string;
	level: ActivityLevelKind;
	label: string;
	at: string;
}): ActivityLevelStart => ({
	kind: ActivityMarkKind.LevelStart,
	id,
	parentId,
	level,
	label,
	at,
});

/** One level closing; every level here settles as passed. */
const levelEnd = ({ id, at }: { id: string; at: string }): ActivityLevelEnd => ({
	kind: ActivityMarkKind.LevelEnd,
	id,
	at,
	outcome: RunStatus.Passed,
});

/** One harness process inside a step level. */
const harnessProcess = ({ levelId, startedAt, endedAt }: { levelId: string; startedAt: string; endedAt: string }): HarnessProcessMark => ({
	kind: ActivityMarkKind.HarnessProcess,
	levelId,
	harness: 'stub',
	spawn: 1,
	reemit: false,
	startedAt,
	endedAt,
	endReason: ProcessEndReason.Completed,
});

/** A step's summary carrying only the invocations a case varies. */
const stepOf = ({ id, invocations }: { id: string; invocations: number }): StepSummary => ({
	id,
	status: RunStatus.Passed,
	attempts: 1,
	durationMs: undefined,
	changedFiles: undefined,
	invocations,
	outputTokens: 0,
	costUsd: 0,
});

/** A finished family run whose summary holds only the steps a case varies; every other figure is empty. */
const buildRunOf = ({ runId, steps }: { runId: string; steps: StepSummary[] }): BuildRun => ({
	manifest: runProgressManifestOf({ runId, status: RunStatus.Passed }),
	summary: {
		wallMs: 0,
		activeMs: 0,
		gateMs: 0,
		usage: undefined,
		cacheReadShare: undefined,
		steps,
		gates: { commands: 0, reruns: 0, skipped: 0, failed: 0, fixed: 0, selfChecks: 0 },
		testResultExecutions: [],
		verificationRepairs: [],
		cleanup: undefined,
		rejectedReports: 0,
		frictionByArea: [],
	},
	runDir: `/repo/.lightsout/runs/${runId}`,
});

/** One friction record written by a run's step. */
const frictionOf = ({ kind, runId, step, detail }: { kind?: FrictionKind; runId: string; step: string; detail: string }): FrictionRecord => ({
	kind,
	area: FrictionArea.Plan,
	detail,
	at: '2026-11-01T11:00:00.000Z',
	runId,
	step,
});

/**
 * A plan folder holding two command runs, each with a step level beneath it.
 * The first command run's step runs two processes at once and the second's
 * runs one, so the plan peaks at two of three processes. The family is the
 * build run and one phase child; the repo's friction record also holds a
 * friction-kind note from the family and a decision from a run outside it.
 */
const setupAgentsSection = () => {
	const report = buildActivityTree({
		plan: 'lo-16-demo/plan-a',
		marks: [
			levelStart({ id: 'plan', level: ActivityLevelKind.Plan, label: 'lo-16-demo/plan-a', at: '2026-11-01T10:00:00.000Z' }),
			levelStart({ id: 'cmd-plan', parentId: 'plan', level: ActivityLevelKind.CommandRun, label: 'plan', at: '2026-11-01T10:00:00.000Z' }),
			levelStart({ id: 'step-grade', parentId: 'cmd-plan', level: ActivityLevelKind.Step, label: 'grade', at: '2026-11-01T10:00:00.000Z' }),
			harnessProcess({ levelId: 'step-grade', startedAt: '2026-11-01T10:00:00.000Z', endedAt: '2026-11-01T10:10:00.000Z' }),
			harnessProcess({ levelId: 'step-grade', startedAt: '2026-11-01T10:05:00.000Z', endedAt: '2026-11-01T10:15:00.000Z' }),
			levelEnd({ id: 'step-grade', at: '2026-11-01T10:15:00.000Z' }),
			levelEnd({ id: 'cmd-plan', at: '2026-11-01T10:20:00.000Z' }),
			levelStart({ id: 'cmd-implement', parentId: 'plan', level: ActivityLevelKind.CommandRun, label: 'implement', at: '2026-11-01T10:30:00.000Z' }),
			levelStart({ id: 'step-implement', parentId: 'cmd-implement', level: ActivityLevelKind.Step, label: 'implement', at: '2026-11-01T10:30:00.000Z' }),
			harnessProcess({ levelId: 'step-implement', startedAt: '2026-11-01T10:30:00.000Z', endedAt: '2026-11-01T10:40:00.000Z' }),
			levelEnd({ id: 'step-implement', at: '2026-11-01T10:40:00.000Z' }),
			levelEnd({ id: 'cmd-implement', at: '2026-11-01T10:45:00.000Z' }),
			levelEnd({ id: 'plan', at: '2026-11-01T10:45:00.000Z' }),
		],
	});
	const runs = [
		buildRunOf({
			runId: 'run-build',
			steps: [stepOf({ id: 'implement', invocations: 2 }), stepOf({ id: 'acceptance-tests', invocations: 0 })],
		}),
		buildRunOf({
			runId: 'run-phase-1',
			steps: [stepOf({ id: 'implement', invocations: 1 }), stepOf({ id: 'refactor', invocations: 1 })],
		}),
	];
	const friction = [
		frictionOf({ kind: FrictionKind.Decision, runId: 'run-build', step: 'implement', detail: 'chose the shorter name' }),
		frictionOf({ kind: FrictionKind.Friction, runId: 'run-build', step: 'implement', detail: 'the plan path was stale' }),
		frictionOf({ runId: 'run-phase-1', step: 'refactor', detail: 'an omitted kind is friction' }),
		frictionOf({ kind: FrictionKind.Decision, runId: 'run-elsewhere', step: 'implement', detail: 'another plan made this call' }),
		frictionOf({ kind: FrictionKind.Decision, runId: 'run-phase-1', step: 'refactor', detail: 'kept the helper private' }),
	];

	return { report, friction, runs, going: false };
};

/**
 * A plan folder with no activity record, its build run still going. With
 * `decided` the build run recorded one judgement call; without it, only a
 * friction-kind note.
 */
const setupWithoutActivity = ({ decided }: { decided: boolean }) => {
	const runs = [buildRunOf({ runId: 'run-build', steps: [] })];
	const friction = [
		frictionOf({ kind: FrictionKind.Friction, runId: 'run-build', step: 'implement', detail: 'the plan path was stale' }),
		...(decided ? [frictionOf({ kind: FrictionKind.Decision, runId: 'run-build', step: 'implement', detail: 'chose the shorter name' })] : []),
	];

	return { report: undefined, friction, runs, going: true };
};

describe('buildAgentsSection', () => {
	test('buildAgentsSection: command runs as the timeline, build agents by step, decision friction for the family only', () => {
		const { report, friction, runs, going } = setupAgentsSection();

		const section = buildAgentsSection({ report, friction, runs, going });

		expect(section).toEqual({
			state: 'finished',
			processes: { value: 3, provenance: 'measured' },
			peakProcesses: { value: 2, provenance: 'measured' },
			byStep: [
				{ step: 'implement', invocations: { value: 3, provenance: 'measured' } },
				{ step: 'refactor', invocations: { value: 1, provenance: 'measured' } },
			],
			timeline: [
				{
					label: 'plan',
					startedAt: '2026-11-01T10:00:00.000Z',
					endedAt: '2026-11-01T10:20:00.000Z',
					outcome: 'passed',
					processes: { value: 2, provenance: 'measured' },
					provenance: 'measured',
				},
				{
					label: 'implement',
					startedAt: '2026-11-01T10:30:00.000Z',
					endedAt: '2026-11-01T10:45:00.000Z',
					outcome: 'passed',
					processes: { value: 1, provenance: 'measured' },
					provenance: 'measured',
				},
			],
			judgementCalls: [
				{ step: 'implement', detail: 'chose the shorter name', provenance: 'reported' },
				{ step: 'refactor', detail: 'kept the helper private', provenance: 'reported' },
			],
		});
	});

	test('buildAgentsSection: absent with no activity record and no judgement call', () => {
		const { report, friction, runs, going } = setupWithoutActivity({ decided: false });

		const section = buildAgentsSection({ report, friction, runs, going });

		expect(section).toBeUndefined();
	});

	test('buildAgentsSection: a judgement call without an activity record shows empty process figures, in progress while going', () => {
		const { report, friction, runs, going } = setupWithoutActivity({ decided: true });

		const section = buildAgentsSection({ report, friction, runs, going });

		expect(section).toEqual({
			state: 'in-progress',
			processes: { value: 0, provenance: 'measured' },
			peakProcesses: { value: 0, provenance: 'measured' },
			byStep: [],
			timeline: [],
			judgementCalls: [{ step: 'implement', detail: 'chose the shorter name', provenance: 'reported' }],
		});
	});
});
