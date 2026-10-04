import { basename, relative } from 'node:path';
import { buildPlanFindingRecheckInvocation } from '#src/agents/buildPlanFindingRecheckInvocation.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import type { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';
import { GapVerdict } from '#src/contracts/plan/grade/GapVerdict.ts';
import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import { planAgentTimeouts } from '#src/plan/common/constants/planAgentTimeouts.ts';
import { findingLocations } from '#src/plan/common/utils/findingLocations.ts';
import { planAgentConcurrency } from '#src/plan/internal/common/constants/planAgentConcurrency.ts';
import { recheckPlanText } from '#src/plan/internal/common/memory/recheckPlanText.ts';
import { recordObservations } from '#src/plan/internal/common/memory/recordObservations.ts';
import { settleRecheckedRecord } from '#src/plan/internal/common/memory/settleRecheckedRecord.ts';
import type { DeliverableFile } from '#src/plan/internal/common/types/DeliverableFile.ts';
import { createPlanAgentRunner } from '#src/plan/internal/common/utils/createPlanAgentRunner.ts';
import { drainTasks } from '#src/plan/internal/common/utils/drainTasks.ts';
import { isRateLimited } from '#src/plan/internal/common/utils/isRateLimited.ts';

/** `planText` is the same text both the judge and the citation check read. */
interface RecheckPair {
	record: GradeFindingRecord;
	location: string;
	/** In first-appearance order. */
	locations: string[];
	observation: GapObservation;
	planText: string;
}

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
	files: DeliverableFile[];
	memory: GradeMemory;
	at: string;
	/** Set when the caller already hit the rate-limit wall: nothing is spawned and every record stays open. */
	skipReason?: string;
	/** The SAME answer the reader selection narrowed by, never a second closure computed here. */
	invalidated: string[];
	/** Substituted for the command run's own before the caller spreads its params in here. */
	level?: ActivityLevel;
}

const locationsOf = ({ record }: { record: GradeFindingRecord }) => findingLocations({ observations: recordObservations({ record }), phase: record.phase });

const recheckPairs = ({
	record,
	locations,
	files,
	overviewText,
}: {
	record: GradeFindingRecord;
	locations: string[];
	files: DeliverableFile[];
	overviewText?: string;
}): RecheckPair[] => {
	const observations = recordObservations({ record });

	return locations.map((location) => ({
		record,
		location,
		locations,
		observation: observations.filter((observation) => observation.phase === location)[0],
		planText: recheckPlanText({ files, overviewText, phase: location }),
	}));
};

/**
 * A location that is not one of the deliverable's current plan files counts as
 * lost whatever `invalidated` holds: no coverage is recorded for it, so once
 * stamped the record would block approval forever even after the plan was
 * repaired.
 */
const isWorthAsking = ({
	record,
	locations,
	invalidated,
	planFiles,
}: {
	record: GradeFindingRecord;
	locations: string[];
	invalidated: string[];
	planFiles: string[];
}) => record.lastRecheckedAt === undefined || locations.some((location) => invalidated.includes(location) || !planFiles.includes(location));

/** Each spawn gets its own runner and transcript, because a shared sink interleaves into one unreadable file. */
const spawnRecheck = async ({ params, pair }: { params: Params; pair: RecheckPair }) => {
	const { cwd, driver, workspaceDir, overviewText, standards, model, effort, permissions, timeoutMs = planAgentTimeouts.judgeMs, level } = params;
	const invokePlanAgent = createPlanAgentRunner({
		cwd,
		driver,
		workspaceDir,
		step: `grade-recheck-${pair.record.id}-${basename(pair.location, '.md')}`,
		level,
		model,
		effort,
		permissions,
		timeoutMs,
	});
	const outcome = await invokePlanAgent({
		invocation: buildPlanFindingRecheckInvocation({
			planText: pair.planText,
			overviewText,
			standards,
			// Only a phased plan has siblings to point at, and a record raised
			// against one phase may now be answered in another.
			planDir: overviewText === undefined ? undefined : relative(cwd, workspaceDir),
			record: pair.record,
			observation: pair.observation,
			locations: pair.locations,
		}),
		contract: GapVerdict,
	});

	return { outcome };
};

/**
 * The only path that closes a record: a later reader's silence is not evidence,
 * so an unanswered record keeps blocking until a judge points at where the plan
 * settles it AND the engine confirms that citation.
 *
 * A record already asked is asked again only when one of its locations lost its
 * read coverage, by the same invalidation the reader selection narrowed by. One
 * not asked stays open and keeps blocking, which is the safe direction.
 */
export const verifyOpenFindings = async (params: Params): Promise<{ memory: GradeMemory; rateLimited: boolean; refusals: Map<string, string> }> => {
	const { cwd, files, overviewText, memory, at, skipReason, invalidated } = params;
	const planFiles = files.map((file) => basename(file.path));
	const located = memory.findings
		.filter((record) => record.status === GradeFindingStatus.Open)
		.map((record) => ({ record, locations: locationsOf({ record }) }));
	const worth = skipReason === undefined ? located.filter((entry) => isWorthAsking({ ...entry, invalidated, planFiles })) : [];
	const asked = worth.map(({ record }) => record);
	const pairs = worth.flatMap(({ record, locations }) => recheckPairs({ record, locations, files, overviewText }));
	const results = await drainTasks({
		tasks: pairs.map((pair) => () => spawnRecheck({ params, pair })),
		concurrency: planAgentConcurrency,
		shouldStop: ({ results: settled }) => settled.some((result) => isRateLimited({ result })),
	});
	const settled = new Map<string, GradeFindingRecord>();
	const refusals = new Map<string, string>();

	for (const record of asked) {
		const answers = pairs.flatMap((pair, slot) =>
			pair.record === record ? [{ location: pair.location, planText: pair.planText, outcome: results[slot]?.outcome }] : [],
		);
		const { record: next, refusal } = await settleRecheckedRecord({ cwd, record, located: answers, at });

		settled.set(record.id, next);

		if (refusal !== undefined) {
			refusals.set(record.id, refusal);
		}
	}

	return {
		memory: { ...memory, findings: memory.findings.map((record) => settled.get(record.id) ?? record) },
		rateLimited: results.some((result) => isRateLimited({ result })),
		refusals,
	};
};
