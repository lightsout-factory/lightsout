import { basename } from 'node:path';
import type { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import { planAgentConcurrency } from '#src/plan/common/constants/planAgentConcurrency.ts';
import { drainTasks } from '#src/plan/common/drainTasks.ts';
import { isRateLimited } from '#src/plan/common/isRateLimited.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { gapCheckLenses } from '#src/plan/runPlanGrade/common/constants/gapCheckLenses.ts';
import type { GapResult } from '#src/plan/runPlanGrade/runGradePass/drainGradeAgents/common/types/GapResult.ts';

interface Params {
	tasks: Array<() => Promise<GapResult>>;
	selected: DeliverableFile[];
}

/**
 * A plan file is claimed as checked only when EVERY lens returned for it. `read`
 * is per file AND lens, so a lens that returned keeps the reading it was paid
 * for even when a sibling lens failed on the same file.
 */
const foldGapResults = ({ selected, results }: { selected: DeliverableFile[]; results: Array<GapResult | undefined> }) => {
	const gaps: GradedGap[] = [];
	const failures: string[] = [];
	const returned = new Map<string, number>();
	const read: Array<{ phase: string; lens: GapCheckLens }> = [];

	for (const result of results) {
		if (result === undefined) {
			continue;
		}

		if (!result.outcome.ok) {
			failures.push(`${result.phase}/${result.lens}: ${result.outcome.rateLimited ? 'rate limited or overloaded' : result.outcome.failure}`);
			continue;
		}

		returned.set(result.phase, (returned.get(result.phase) ?? 0) + 1);
		read.push({ phase: result.phase, lens: result.lens });
		// Findings start unjudged: the judging stage rules each one, and anything it
		// never settles keeps this stamp and blocks.
		gaps.push(...result.outcome.report.gaps.map((gap) => ({ ...gap, phase: result.phase, lens: result.lens, outcome: GapOutcome.Unjudged, observations: [] })));
	}

	const phasesChecked = selected.map((file) => basename(file.path)).filter((phase) => returned.get(phase) === gapCheckLenses.length);

	return { gaps, failures, phasesChecked, read };
};

/**
 * Once one checker rate-limits no further one starts: a usage budget does not
 * clear in minutes. A hard failure is usually specific to one checker and does
 * NOT stop the queue.
 */
export const drainGapCheckers = async ({
	tasks,
	selected,
}: Params): Promise<{
	gaps: GradedGap[];
	failures: string[];
	phasesChecked: string[];
	read: Array<{ phase: string; lens: GapCheckLens }>;
	rateLimited: boolean;
}> => {
	const results = await drainTasks({
		tasks,
		concurrency: planAgentConcurrency,
		shouldStop: ({ results: settled }) => settled.some((result) => isRateLimited({ result })),
	});

	return { ...foldGapResults({ selected, results }), rateLimited: results.some((result) => isRateLimited({ result })) };
};
