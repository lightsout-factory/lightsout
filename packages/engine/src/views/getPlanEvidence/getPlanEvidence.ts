import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import { spanOfActivityNodes } from '#src/common/spanOfActivityNodes.ts';
import type { ActivityReport } from '#src/contracts/activity/ActivityReport.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import type { EvidenceHeadline } from '#src/contracts/views/planEvidence/EvidenceHeadline.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { readFriction } from '#src/runState/friction/readFriction.ts';
import { measuredCount } from '#src/views/common/measuredCount.ts';
import { buildAgentsSection } from '#src/views/getPlanEvidence/buildAgentsSection.ts';
import { buildChecksSection } from '#src/views/getPlanEvidence/buildChecksSection.ts';
import { buildCleanupSection } from '#src/views/getPlanEvidence/buildCleanupSection.ts';
import { buildPlanSection } from '#src/views/getPlanEvidence/buildPlanSection.ts';
import { buildShipSection } from '#src/views/getPlanEvidence/buildShipSection.ts';
import { buildTestsSection } from '#src/views/getPlanEvidence/buildTestsSection.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';
import { readBuildFamily } from '#src/views/getPlanEvidence/readBuildFamily.ts';
import { getPlanWorkspace } from '#src/views/getPlanWorkspace/getPlanWorkspace.ts';
import { PlanWorkspaceNotFoundError } from '#src/views/PlanWorkspaceNotFoundError.ts';
import { readPlanActivityReports } from '#src/views/readPlanActivityReports.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	cwd: string;
	/** The plan's address, `<work-order>/<plan-id>`. */
	name: string;
}

/** A build that can still move: its sections are drawn so far, and marked. */
const goingStatuses = new Set<RunStatus>([RunStatus.Running, RunStatus.Pending, RunStatus.PausedRateLimit, RunStatus.PausedBudget]);

/** Each commit counted once, though a coordinator and the phase child that made it both record it. */
const sumCommitLines = ({ runs }: { runs: BuildRun[] }): PlanEvidence['lines'] => {
	const bySha = new Map(runs.flatMap((run) => run.manifest.commitLines ?? []).map((entry) => [entry.sha, entry]));

	if (bySha.size === 0) {
		return undefined;
	}

	const entries = [...bySha.values()];

	return {
		added: measuredCount({ value: entries.reduce((total, entry) => total + entry.added, 0) }),
		removed: measuredCount({ value: entries.reduce((total, entry) => total + entry.removed, 0) }),
	};
};

/** The merge belongs to the branch: the ship result's when it shipped, else the record's own stamp. */
const buildHeadline = ({
	report,
	record,
	plan,
	cleanup,
	ship,
}: {
	report: ActivityReport | undefined;
	record: WorkOrderState | undefined;
	plan: PlanEvidence['plan'];
	cleanup: PlanEvidence['cleanup'];
	ship: PlanEvidence['ship'];
}): EvidenceHeadline => {
	const roots = report?.roots ?? [];
	const costUsd = report?.totals.usage.costUsd;
	const standards = cleanup?.standards;

	return {
		startedAt: roots.length === 0 ? undefined : spanOfActivityNodes({ nodes: roots }).startedAt,
		mergedAt: ship?.result?.status === ShipStatus.Shipped ? ship.result.mergedAt : record?.shipped?.at,
		questionsAsked: plan?.questionsAsked,
		recordedCostUsd: costUsd === undefined ? undefined : measuredCount({ value: costUsd }),
		findingsFixed: standards?.found === undefined ? undefined : measuredCount({ value: standards.fixed.length }),
	};
};

/** The work order's record, or one problem line naming why it could not be read. */
const readRecord = async ({ cwd, workOrderName }: { cwd: string; workOrderName: string }) => {
	const read = await readWorkOrderState({ cwd, name: workOrderName });

	return 'error' in read
		? { record: undefined, problems: [`the work order record for ${workOrderName} could not be read: ${read.error}`] }
		: { record: read.record, problems: [] };
};

/**
 * A view over records each step already wrote, so a paused or failed build still shows
 * what it did so far; the summary adds no facts of its own.
 *
 * @throws {PlanWorkspaceNotFoundError} When the name is no plan address, or no plan folder answers to it.
 */
export const getPlanEvidence = async ({ cwd, name }: Params): Promise<PlanEvidence> => {
	// First, so its not-found guard is this view's guard and no other read reaches an unknown name.
	const workspace = await getPlanWorkspace({ cwd, name });
	const address = parsePlanAddress({ name });

	if (address === undefined) {
		throw new PlanWorkspaceNotFoundError({ name });
	}

	const { workOrderName, planId } = address;
	const { record, problems } = await readRecord({ cwd, workOrderName });
	const buildRunId = record?.plans.find((plan) => plan.id === planId)?.implementation?.runId;
	const family = buildRunId === undefined ? { runs: [], problems: [] } : await readBuildFamily({ cwd, workOrderName, runId: buildRunId });
	const [[activity], friction, shipped] = await Promise.all([
		readPlanActivityReports({ cwd, names: [name] }),
		readFriction({ cwd }),
		record === undefined ? { section: undefined, problems: [] } : buildShipSection({ cwd, branch: record.branch }),
	]);
	const report = activity?.report;
	const runStatus = family.runs.at(0)?.manifest.status;
	const going = runStatus !== undefined && goingStatuses.has(runStatus);
	const { runs } = family;
	const plan = buildPlanSection({ workspace });
	const cleanup = buildCleanupSection({ runs, dedup: workspace.dedup, going });

	return {
		name,
		buildRunId,
		runStatus,
		headline: buildHeadline({ report, record, plan, cleanup, ship: shipped.section }),
		lines: sumCommitLines({ runs }),
		plan,
		tests: await buildTestsSection({ cwd, runs, going }),
		checks: buildChecksSection({ runs, going }),
		cleanup,
		agents: buildAgentsSection({ report, friction, runs, going: going || workspace.planningLive }),
		ship: shipped.section,
		problems: [...problems, ...family.problems, ...shipped.problems],
	};
};
