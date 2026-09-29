import { join } from 'node:path';
import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import { buildPlanRepairInvocation } from '#src/agents/buildPlanRepairInvocation.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { PlanFixReport } from '#src/contracts/plan/draft/PlanFixReport.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { getAgentOutcomeStatus } from '#src/invoke/getAgentOutcomeStatus.ts';
import { convergeFindings } from '#src/plan/draft/internal/common/utils/convergeFindings.ts';
import { repairMechanicalFindings } from '#src/plan/draft/repairMechanicalFindings.ts';
import type { PlanRepairResult } from '#src/plan/internal/common/types/PlanRepairResult.ts';
import { createPlanAgentRunner } from '#src/plan/internal/common/utils/createPlanAgentRunner.ts';
import { lintPlanStructure } from '#src/plan/lint/lintPlanStructure.ts';

interface Params {
	cwd: string;
	driver: Driver;
	/** Kebab plan name — narrated in progress lines and in the parked re-run command. */
	name: string;
	/** Absolute paths to the drafted plan file(s) the repairer may edit in place. */
	planPaths: string[];
	/** The plan's workspace dir: repair transcripts land here, as do the facts/decisions the repairer is pointed at. */
	workspaceDir: string;
	/** Absolute path of the workspace's brainstorm-decisions.json when one exists — the repairer Reads it alongside the plan's own decisions. */
	brainstormDecisionsPath?: string;
	/** The merged record the draft was started from — what the loop's own lint holds the plan's Decision Log to. */
	decisions: DecisionsRecord;
	config?: LightsoutConfig;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	timeoutMs: number;
	/** The command-run level each repair attempt opens its own pass level under. Absent wherever no run is being recorded. */
	level?: ActivityLevel;
	progress: (message: string) => void;
	/** Absolute path of the overview when the deliverable is phased. */
	overviewPath?: string;
}

/** The activity level and the transcript share the attempt number, so a report row and a transcript are findable from each other. */
const runRepairAttempt = async ({ params, findings, attempt }: { params: Params; findings: StructuralFinding[]; attempt: number }) => {
	const { cwd, driver, planPaths, workspaceDir, brainstormDecisionsPath, config, model, effort, permissions, timeoutMs } = params;
	const round = params.level?.open({ level: ActivityLevelKind.Pass, label: `structural repair ${attempt}` });
	const invokePlanAgent = createPlanAgentRunner({ cwd, driver, workspaceDir, step: `repair-${attempt}`, model, effort, permissions, timeoutMs, level: round });
	const outcome = await invokePlanAgent({
		invocation: buildPlanRepairInvocation({
			findings,
			planPaths,
			decisionsPath: join(workspaceDir, 'decisions.json'),
			brainstormDecisionsPath,
			factsPath: join(workspaceDir, 'facts.json'),
			docs: config?.docs,
		}),
		contract: PlanFixReport,
	});

	round?.close({ outcome: getAgentOutcomeStatus({ outcome }) });

	return outcome;
};

/**
 * The lint always answers, so the unreadable-inputs exit `convergeFindings`
 * offers is unreachable here: a plan file the repairer broke comes back as a
 * finding.
 *
 * Every round regenerates the engine-owned sections before it lints, because
 * the repairer is forbidden to touch them and so could never fix one it damaged.
 */
export const repairPlanStructure = async (params: Params): Promise<PlanRepairResult> => {
	const { cwd, name, planPaths, decisions, config, progress, overviewPath } = params;

	return convergeFindings({
		name,
		verb: 'repair',
		findingNoun: 'structural finding(s)',
		check: async () => {
			await repairMechanicalFindings({ cwd, name, planPaths, decisions, overviewPath });

			return lintPlanStructure({ cwd, planPaths, decisions, config });
		},
		unreadableError: `the plan file(s) could not be linted at ${planPaths.join(', ')}`,
		runAttempt: ({ findings, attempt }) => runRepairAttempt({ params, findings, attempt }),
		progress,
	});
};
