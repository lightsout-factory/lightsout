import type { GapBatchVerdict } from '#src/contracts/plan/grade/GapBatchVerdict.ts';
import type { GapGroupVerdict } from '#src/contracts/plan/grade/GapGroupVerdict.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { AgentOutcome } from '#src/invoke/common/types/AgentOutcome.ts';
import { findingLocations } from '#src/plan/common/utils/findingLocations.ts';
import { noJudgeRanReason } from '#src/plan/internal/common/constants/noJudgeRanReason.ts';
import { confirmCitation } from '#src/plan/internal/common/memory/confirmCitation.ts';
import { dedupeObservations } from '#src/plan/internal/common/observations/dedupeObservations.ts';
import { gapObservations } from '#src/plan/internal/common/observations/gapObservations.ts';
import type { GapBatch } from '#src/plan/internal/common/types/GapBatch.ts';
import type { GapRuling } from '#src/plan/internal/common/types/GapRuling.ts';

interface Params {
	cwd: string;
	batch: GapBatch;
	/** `undefined` where the fan-out never started this batch's judge. */
	outcome?: AgentOutcome<GapBatchVerdict>;
	/** What a verdict's `matchesFinding` may name. */
	recordIds: Set<string>;
	noJudgeReason?: string;
}

type BatchMember = GapBatch['observations'][number];

/** An evidence field the judge left blank counts the same as one it omitted. */
const isFilled = ({ value }: { value?: string }) => (value ?? '').trim().length > 0;

const hasRequiredEvidence = ({ verdict }: { verdict: GapGroupVerdict }) => {
	const demanded: Record<GapGroupVerdict['outcome'], boolean> = {
		[GapOutcome.NeedsAHuman]: isFilled({ value: verdict.humanDecision }),
		[GapOutcome.AgentCanDecide]: isFilled({ value: verdict.agentDecision }) && isFilled({ value: verdict.safeBecause }),
		[GapOutcome.AlreadyAnswered]: verdict.answers.length > 0 && verdict.answers.every(({ answerAt }) => isFilled({ value: answerAt })),
	};

	return demanded[verdict.outcome];
};

/**
 * A dismissal needs one citation per location the covered findings span, each
 * confirmed against its own file's text: one citation waving away a
 * contradiction observed in two files is the dismissal this exists to refuse.
 */
const refuseCitations = async ({ cwd, batch, verdict, covered }: { cwd: string; batch: GapBatch; verdict: GapGroupVerdict; covered: BatchMember[] }) => {
	const texts = new Map(batch.planTexts.map(({ phase, text }) => [phase, text]));
	const cited = verdict.answers.map(({ phase }) => phase);
	const spanned = covered.flatMap(({ gap }) => findingLocations({ observations: gap.observations, phase: gap.phase }));
	const missing = [...new Set(spanned)].filter((phase) => texts.has(phase) && !cited.includes(phase));
	const repeated = cited.filter((phase, position) => cited.indexOf(phase) !== position);
	const foreign = cited.filter((phase) => !texts.has(phase));
	let reason: string | undefined;

	if (missing.length > 0) {
		reason = `the judge dismissed this as already answered but cited nothing for ${missing.join(', ')}`;
	} else if (repeated.length > 0) {
		reason = `the judge cited ${repeated.join(', ')} more than once`;
	} else if (foreign.length > 0) {
		reason = `the judge cited ${foreign.join(', ')}, a plan file this batch holds no text for`;
	} else {
		for (const { phase, answerAt } of verdict.answers) {
			const confirmed = await confirmCitation({ cwd, citation: answerAt, planText: texts.get(phase) ?? '' });

			if (!confirmed.ok) {
				reason = `the judge's citation for ${phase} was refused — ${confirmed.reason}`;
				break;
			}
		}
	}

	return reason;
};

const refuseVerdict = async ({ cwd, batch, verdict, recordIds }: { cwd: string; batch: GapBatch; verdict: GapGroupVerdict; recordIds: Set<string> }) => {
	const covers = [...new Set(verdict.covers)];
	const unknown = covers.filter((id) => !batch.observations.some((member) => member.id === id));
	let reason: string | undefined;

	if (unknown.length > 0) {
		reason = `the judge's ruling named ${unknown.join(', ')}, which this batch never handed out, so the whole ruling is void`;
	} else if (covers.length > 1 && !isFilled({ value: verdict.sharedDefect })) {
		reason = `the judge grouped ${covers.join(', ')} as one defect without the shared-defect statement a group demands`;
	} else if (!hasRequiredEvidence({ verdict })) {
		reason = `the judge answered ${verdict.outcome} without the evidence that outcome demands`;
	} else if (verdict.outcome === GapOutcome.AlreadyAnswered) {
		// Only a dismissal's citations are checked: the other two outcomes may name
		// a path the plan is about to create.
		reason = await refuseCitations({ cwd, batch, verdict, covered: batch.observations.filter(({ id }) => covers.includes(id)) });
	}

	if (reason === undefined && verdict.matchesFinding !== undefined && !recordIds.has(verdict.matchesFinding)) {
		reason = `the judge matched this finding to ${verdict.matchesFinding}, which is not a record this plan holds`;
	}

	return reason;
};

const standingRulings = ({ verdict, members }: { verdict: GapGroupVerdict; members: BatchMember[] }): Array<[number, GapRuling]> => {
	const observations = dedupeObservations({ observations: members.flatMap(({ gap }) => gapObservations({ gap })) });
	// The first member's position in the pass belongs to it alone, so the group id
	// cannot collide with a group another batch forms in the same fold.
	const group = members.length > 1 ? { groupId: `g${members[0].index}`, observations } : {};

	return members.map(({ index, gap }) => [index, { verdict, answerAt: verdict.answers.find(({ phase }) => phase === gap.phase)?.answerAt, ...group }]);
};

/**
 * Returns one ruling per observation the batch supplied, keyed by its position
 * in the pass's gap array — never fewer.
 *
 * Every observation must be covered by exactly one ruling. One nobody covered
 * and one covered twice are left unjudged, which blocks: an ambiguous
 * attribution never removes an obligation. A ruling naming an identifier the
 * engine never handed out is void in full, while the rulings beside it still
 * stand.
 */
export const accountBatchVerdicts = async ({ cwd, batch, outcome, recordIds, noJudgeReason }: Params): Promise<Map<number, GapRuling>> => {
	if (outcome === undefined || !outcome.ok) {
		let unjudgedReason = noJudgeReason ?? noJudgeRanReason;

		if (outcome !== undefined) {
			unjudgedReason = outcome.rateLimited ? 'the judge was rate limited or overloaded' : outcome.failure;
		}

		return new Map<number, GapRuling>(batch.observations.map(({ index }) => [index, { unjudgedReason }]));
	}

	const verdicts = outcome.report.verdicts;
	const coverage = ({ id }: { id: string }) => verdicts.filter((verdict) => verdict.covers.includes(id)).length;
	const rulings = new Map<number, GapRuling>();

	for (const verdict of verdicts) {
		const refusal = await refuseVerdict({ cwd, batch, verdict, recordIds });
		const members = batch.observations.filter(({ id }) => verdict.covers.includes(id) && coverage({ id }) === 1);
		const settled: Array<[number, GapRuling]> =
			refusal === undefined ? standingRulings({ verdict, members }) : members.map(({ index }) => [index, { unjudgedReason: refusal }]);

		for (const [index, ruling] of settled) {
			rulings.set(index, ruling);
		}
	}

	for (const { id, index } of batch.observations) {
		const count = coverage({ id });

		if (count === 0) {
			rulings.set(index, { unjudgedReason: "the judge's rulings did not cover this observation" });
		} else if (count > 1) {
			rulings.set(index, { unjudgedReason: "more than one of the judge's rulings covered this observation, so none of them can settle it" });
		}
	}

	return rulings;
};
