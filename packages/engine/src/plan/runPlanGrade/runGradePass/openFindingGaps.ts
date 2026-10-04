import { isBlockingGap } from '#src/common/isBlockingGap.ts';
import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';

interface Params {
	memory: GradeMemory;
	gaps: GradedGap[];
	/** Record id → why `verifyOpenFindings` refused to close it this pass. */
	refusals?: Map<string, string>;
}

const blockingRuling = ({ record, refusals }: { record: GradeFindingRecord; refusals?: Map<string, string> }) =>
	record.status === GradeFindingStatus.Pending
		? { outcome: GapOutcome.Unjudged, unjudgedReason: record.unjudgedReason }
		: { outcome: GapOutcome.NeedsAHuman, humanDecision: record.humanDecision, unjudgedReason: refusals?.get(record.id) };

/**
 * A reader's silence is not evidence the question was answered, so every
 * blocking record surfaces as a gap whether or not a reader re-reported it.
 *
 * A record is skipped only when a gap in this pass carries its id AND that gap
 * is itself blocking. A judge ruling a matched finding non-blocking answered a
 * reader's paraphrase, not the record, so it must not hide an open record.
 */
export const openFindingGaps = ({ memory, gaps, refusals }: Params): GradedGap[] => {
	const carried = new Set(gaps.filter((gap) => isBlockingGap({ gap })).map((gap) => gap.findingId));
	const blocking: GradeFindingStatus[] = [GradeFindingStatus.Open, GradeFindingStatus.Pending];

	return memory.findings
		.filter((record) => blocking.includes(record.status) && !carried.has(record.id))
		.map((record) => ({
			area: record.area,
			gap: record.gap,
			decision: record.decision,
			options: record.options,
			phase: record.phase,
			lens: record.lens,
			observations: record.observations,
			sharedDefect: record.sharedDefect,
			...blockingRuling({ record, refusals }),
			findingId: record.id,
		}));
};
