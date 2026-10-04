import { relative } from 'node:path';
import { buildPlanGapJudgeInvocation } from '#src/agents/buildPlanGapJudgeInvocation.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import { GapBatchVerdict } from '#src/contracts/plan/grade/GapBatchVerdict.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import { planAgentConcurrency } from '#src/plan/common/constants/planAgentConcurrency.ts';
import { planAgentTimeouts } from '#src/plan/common/constants/planAgentTimeouts.ts';
import { createPlanAgentRunner } from '#src/plan/common/createPlanAgentRunner.ts';
import { drainTasks } from '#src/plan/common/drainTasks.ts';
import { isRateLimited } from '#src/plan/common/isRateLimited.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { phaseFindingRecords } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/common/phaseFindingRecords.ts';
import type { GapBatch } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/judgeGaps/common/types/GapBatch.ts';
import { groupGapCandidates } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/judgeGaps/groupGapCandidates/groupGapCandidates.ts';
import { matchGapVerdicts } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/judgeGaps/matchGapVerdicts/matchGapVerdicts.ts';

interface Params {
	cwd: string;
	driver: Driver;
	workspaceDir: string;
	overviewText?: string;
	standards?: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	timeoutMs?: number;
	/** Every plan file: a carried pending record may name a file this pass's readers were never offered. */
	files: DeliverableFile[];
	gaps: GradedGap[];
	/** Set when the reader fan-out already hit the rate-limit wall: no judge is spawned and every finding keeps this as its reason. */
	skipReason?: string;
	memory: GradeMemory;
	/** It arrives through the caller's spread, so no call site names it. */
	level?: ActivityLevel;
}

/** Not `superseded`: its question lives on the record that absorbed it, and a finding attached to one would land on a record nothing checks. */
const judgeableStatuses: GradeFindingStatus[] = Object.values(GradeFindingStatus).filter((status) => status !== GradeFindingStatus.Superseded);

/** Each record listed once: a grouped record is returned for each of its locations, and a judge shown it twice would read one question as two. */
const batchRecords = ({ memory, batch }: { memory: GradeMemory; batch: GapBatch }) => [
	...new Map(
		batch.planTexts.flatMap(({ phase }) => phaseFindingRecords({ memory, phase, statuses: judgeableStatuses })).map((record) => [record.id, record]),
	).values(),
];

/** Each judge gets its own runner and transcript, because a shared sink interleaves into one unreadable file. */
const spawnGapJudge = async ({ params, batch, batchIndex }: { params: Params; batch: GapBatch; batchIndex: number }) => {
	const { cwd, driver, workspaceDir, overviewText, standards, model, effort, permissions, timeoutMs = planAgentTimeouts.judgeMs, level } = params;
	const invokePlanAgent = createPlanAgentRunner({
		cwd,
		driver,
		workspaceDir,
		step: `grade-judge-${batchIndex}`,
		level,
		model,
		effort,
		permissions,
		timeoutMs,
	});
	const outcome = await invokePlanAgent({
		invocation: buildPlanGapJudgeInvocation({
			planTexts: batch.planTexts,
			overviewText,
			standards,
			// Only a phased plan has siblings to point at, and the judge opens one
			// itself when an observation is about a seam its batch does not span.
			planDir: overviewText === undefined ? undefined : relative(cwd, workspaceDir),
			records: batchRecords({ memory: params.memory, batch }),
			observations: batch.observations.map(({ id, gap }) => ({ id, observation: gap })),
		}),
		contract: GapBatchVerdict,
	});

	return { outcome };
};

/**
 * The input `gaps` array is what comes back, same members in the same order.
 * Building the result FROM the input is the only shape where a finding cannot
 * silently disappear.
 */
export const judgeGaps = async (params: Params): Promise<{ gaps: GradedGap[]; rateLimited: boolean }> => {
	const { cwd, files, gaps, skipReason, memory } = params;
	// A skipped pass still goes through the join, which is the one place an
	// unjudged finding gets its stamp and its reason.
	const batches = skipReason === undefined ? groupGapCandidates({ gaps, files }) : [];
	const results = await drainTasks({
		tasks: batches.map((batch, batchIndex) => () => spawnGapJudge({ params, batch, batchIndex })),
		concurrency: planAgentConcurrency,
		shouldStop: ({ results: settled }) => settled.some((result) => isRateLimited({ result })),
	});
	const recordIds = new Set(memory.findings.filter(({ status }) => judgeableStatuses.includes(status)).map(({ id }) => id));

	return {
		gaps: await matchGapVerdicts({ cwd, gaps, batches, batchOutcomes: results.map((result) => result?.outcome), noJudgeReason: skipReason, recordIds }),
		rateLimited: results.some((result) => isRateLimited({ result })),
	};
};
