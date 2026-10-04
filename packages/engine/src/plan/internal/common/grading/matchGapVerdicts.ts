import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { GapBatchVerdict } from '#src/contracts/plan/grade/GapBatchVerdict.ts';
import type { GapGroupVerdict } from '#src/contracts/plan/grade/GapGroupVerdict.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import { noJudgeRanReason } from '#src/plan/internal/common/constants/noJudgeRanReason.ts';
import { accountBatchVerdicts } from '#src/plan/internal/common/grading/accountBatchVerdicts.ts';
import type { GapBatch } from '#src/plan/internal/common/types/GapBatch.ts';
import type { GapRuling } from '#src/plan/internal/common/types/GapRuling.ts';

interface Params {
	cwd: string;
	/** In the order the batches index them by. */
	gaps: GradedGap[];
	batches: GapBatch[];
	/** At the same index as `batches`; `undefined` where the fan-out never started that judge. */
	batchOutcomes: Array<AgentOutcome<GapBatchVerdict> | undefined>;
	/** Defaults to the fan-out having stopped mid-flight. */
	noJudgeReason?: string;
	/** Absent means the plan has none, so any id points nowhere. */
	recordIds?: Set<string>;
}

/** Only the fields the verdict holds, so an absent one stays absent rather than reading as an explicit nothing. */
const rulingFields = ({ verdict }: { verdict: GapGroupVerdict }) => ({
	outcome: verdict.outcome,
	...(verdict.humanDecision === undefined ? {} : { humanDecision: verdict.humanDecision }),
	...(verdict.agentDecision === undefined ? {} : { agentDecision: verdict.agentDecision }),
	...(verdict.safeBecause === undefined ? {} : { safeBecause: verdict.safeBecause }),
});

const joinRuling = ({ gap, ruling, noJudgeReason }: { gap: GradedGap; ruling?: GapRuling; noJudgeReason?: string }): GradedGap => {
	const verdict = ruling?.unjudgedReason === undefined ? ruling?.verdict : undefined;

	if (verdict === undefined) {
		return { ...gap, outcome: GapOutcome.Unjudged, unjudgedReason: ruling?.unjudgedReason ?? noJudgeReason ?? noJudgeRanReason };
	}

	return {
		...gap,
		// A carried pending finding arrives with the reason an earlier pass left it
		// unjudged; once a judge rules, that reason is stale.
		...(gap.unjudgedReason === undefined ? {} : { unjudgedReason: undefined }),
		...rulingFields({ verdict }),
		...(ruling?.answerAt === undefined ? {} : { answerAt: ruling.answerAt }),
		...(ruling?.observations === undefined ? {} : { groupId: ruling.groupId, sharedDefect: verdict.sharedDefect, observations: ruling.observations }),
		// A carried finding with no match keeps the record it already belongs to, or
		// it would open a second one every pass.
		...(verdict.matchesFinding === undefined ? {} : { findingId: verdict.matchesFinding }),
	};
};

/**
 * The findings drive the loop and the result keeps their membership and order
 * exactly, so a finding can never vanish between the readers and the report.
 *
 * Every unjudged gap is stamped here and nowhere else, including a finding no
 * batch held because its plan file no longer exists.
 */
export const matchGapVerdicts = async ({ cwd, gaps, batches, batchOutcomes, noJudgeReason, recordIds = new Set() }: Params): Promise<GradedGap[]> => {
	const rulings = new Map<number, GapRuling>();

	for (const [slot, batch] of batches.entries()) {
		const accounted = await accountBatchVerdicts({ cwd, batch, outcome: batchOutcomes[slot], recordIds, noJudgeReason });

		for (const [index, ruling] of accounted) {
			rulings.set(index, ruling);
		}
	}

	return gaps.map((gap, index) => joinRuling({ gap, ruling: rulings.get(index), noJudgeReason }));
};
