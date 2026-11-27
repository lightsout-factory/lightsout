import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { ActivityNode } from '#src/contracts/activity/ActivityNode.ts';
import type { ActivityReport } from '#src/contracts/activity/ActivityReport.ts';
import { FrictionKind } from '#src/contracts/friction/FrictionEntry/FrictionKind.ts';
import type { FrictionRecord } from '#src/contracts/friction/FrictionRecord.ts';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';
import { EvidenceSectionState } from '#src/contracts/views/planEvidence/EvidenceSectionState.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import { measuredCount } from '#src/views/common/measuredCount.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';

interface Params {
	/** The plan's activity report; undefined when its folder holds no activity record. */
	report: ActivityReport | undefined;
	/** The repo's whole friction record, as `readFriction` answers it. */
	friction: FrictionRecord[];
	/** The build family, for its run ids and each run's per-step agent invocations; empty before the plan was built. */
	runs: BuildRun[];
	/** Planning is live, or the build run is running, pending or paused. */
	going: boolean;
}

/** Every command-run level in depth-first tree order; a step level is opened per agent invocation, so it is never listed. */
const commandRuns = ({ nodes }: { nodes: ActivityNode[] }): ActivityNode[] =>
	nodes.flatMap((node) => [...(node.level === ActivityLevelKind.CommandRun ? [node] : []), ...commandRuns({ nodes: node.children })]);

/** Build agent invocations merged by step across the family, in first-seen order; a step that invoked none is left out. */
const invocationsByStep = ({ runs }: { runs: BuildRun[] }) => {
	const byStep = new Map<string, number>();

	for (const step of runs.flatMap((run) => run.summary.steps)) {
		if (step.invocations > 0) {
			byStep.set(step.id, (byStep.get(step.id) ?? 0) + step.invocations);
		}
	}

	return [...byStep.entries()].map(([step, invocations]) => ({ step, invocations: measuredCount({ value: invocations }) }));
};

/**
 * Process totals and the peak are read from the fold, never re-summed: a peak spans the
 * whole plan. Only decision-kind friction from the family's own runs counts as a judgement
 * call; the rest is a note for improving the engine. Absent with no activity and no call.
 */
export const buildAgentsSection = ({ report, friction, runs, going }: Params): PlanEvidence['agents'] => {
	const familyIds = new Set(runs.map((run) => run.manifest.runId));
	const decisions = friction.filter((entry) => entry.kind === FrictionKind.Decision && familyIds.has(entry.runId));
	const judgementCalls = decisions.map((entry) => ({ step: entry.step, detail: entry.detail, provenance: EvidenceProvenance.Reported }));

	if (report === undefined && judgementCalls.length === 0) {
		return undefined;
	}

	return {
		state: going ? EvidenceSectionState.InProgress : EvidenceSectionState.Finished,
		processes: measuredCount({ value: report?.totals.processCount ?? 0 }),
		peakProcesses: measuredCount({ value: report?.totals.peakProcesses ?? 0 }),
		byStep: invocationsByStep({ runs }),
		timeline: commandRuns({ nodes: report?.roots ?? [] }).map((node) => ({
			label: node.label,
			startedAt: node.startedAt,
			endedAt: node.endedAt,
			outcome: node.outcome,
			processes: measuredCount({ value: node.totals.processCount }),
			provenance: EvidenceProvenance.Measured,
		})),
		judgementCalls,
	};
};
