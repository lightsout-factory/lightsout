import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { buildPlanReshapeInvocation } from '#src/agents/buildPlanReshapeInvocation.ts';
import { touchedFileCeiling } from '#src/common/constants/touchedFileCeiling.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import { PlanFixReport } from '#src/contracts/plan/draft/PlanFixReport.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { getAgentOutcomeStatus } from '#src/invoke/getAgentOutcomeStatus.ts';
import { createdFileCeiling } from '#src/plan/common/constants/createdFileCeiling.ts';
import { convergeFindings } from '#src/plan/draft/internal/common/utils/convergeFindings.ts';
import type { PlanRepairResult } from '#src/plan/internal/common/types/PlanRepairResult.ts';
import { createPlanAgentRunner } from '#src/plan/internal/common/utils/createPlanAgentRunner.ts';
import { checkPhaseBreakdown } from '#src/plan/lint/checkPhaseBreakdown.ts';

interface Params {
	cwd: string;
	driver: Driver;
	/** Kebab plan name — narrated in progress lines and in the parked re-run command. */
	name: string;
	/** Absolute path of the overview the reshaper may edit in place. */
	overviewPath: string;
	/** The plan's workspace: reshape transcripts, facts and decisions live here. */
	workspaceDir: string;
	/** Absolute path of the workspace's brainstorm-decisions.json when one exists. */
	brainstormDecisionsPath?: string;
	/** `executor-file-limit` from config, already defaulted. */
	executorFileLimit: number;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	timeoutMs: number;
	/** The command-run level each reshape round opens its own pass level under. Absent wherever no run is being recorded. */
	level?: ActivityLevel;
	progress: (message: string) => void;
}

const checkOverviewOnDisk = async ({ overviewPath, executorFileLimit }: { overviewPath: string; executorFileLimit: number }) => {
	const overviewText = await readFile(overviewPath, 'utf8').catch(() => undefined);

	return overviewText === undefined ? undefined : checkPhaseBreakdown({ overviewText, overviewBase: basename(overviewPath), executorFileLimit });
};

/** Its own agent runner and activity level, so each attempt keeps its own transcript and the report can say which round burned the time. */
const runReshapeAttempt = async ({ params, findings, attempt }: { params: Params; findings: StructuralFinding[]; attempt: number }) => {
	const { cwd, driver, overviewPath, workspaceDir, brainstormDecisionsPath, model, effort, permissions, timeoutMs } = params;
	const round = params.level?.open({ level: ActivityLevelKind.Pass, label: `breakdown reshape ${attempt}` });
	const invokePlanAgent = createPlanAgentRunner({
		cwd,
		driver,
		workspaceDir,
		step: `breakdown-repair-${attempt}`,
		model,
		effort,
		permissions,
		timeoutMs,
		level: round,
	});
	const outcome = await invokePlanAgent({
		invocation: buildPlanReshapeInvocation({
			findings,
			planPaths: [overviewPath],
			createdFileCeiling,
			touchedFileCeiling,
			decisionsPath: join(workspaceDir, 'decisions.json'),
			brainstormDecisionsPath,
			factsPath: join(workspaceDir, 'facts.json'),
		}),
		contract: PlanFixReport,
	});

	round?.close({ outcome: getAgentOutcomeStatus({ outcome }) });

	return outcome;
};

/** A `complete` result carries the surviving findings, so the caller decides what a survivor means. */
export const repairPhaseBreakdown = async (params: Params): Promise<PlanRepairResult> => {
	const { name, overviewPath, executorFileLimit, progress } = params;

	return convergeFindings({
		name,
		verb: 'reshape',
		findingNoun: 'phase-breakdown finding(s)',
		check: () => checkOverviewOnDisk({ overviewPath, executorFileLimit }),
		unreadableError: `overview could not be read at ${overviewPath}`,
		runAttempt: ({ findings, attempt }) => runReshapeAttempt({ params, findings, attempt }),
		progress,
	});
};
