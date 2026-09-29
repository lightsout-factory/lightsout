import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';
import { isBlockingGap } from '#src/plan/common/utils/isBlockingGap.ts';
import { dedupeObservations } from '#src/plan/internal/common/observations/dedupeObservations.ts';
import { gapObservations } from '#src/plan/internal/common/observations/gapObservations.ts';

interface Params {
	gaps: GradedGap[];
}

const collapseSide = ({ gap, gaps }: { gap: GradedGap; gaps: GradedGap[] }) => {
	const blocking = isBlockingGap({ gap });
	const side = gaps.filter((member) => member.findingId === gap.findingId && isBlockingGap({ gap: member }) === blocking);
	let collapsed: GradedGap[] = [];

	if (side.length === 1) {
		collapsed = [gap];
	} else if (side[0] === gap) {
		collapsed = [{ ...gap, observations: dedupeObservations({ observations: side.flatMap((member) => gapObservations({ gap: member })) }) }];
	}

	return collapsed;
};

/**
 * Gaps sharing a record id collapse into one survivor that keeps the first
 * member's place and carries every member's observations.
 *
 * Each blocking side collapses on its own, so one record yields at most one
 * blocker and one note: a pass gap ruled a note can carry the id of a record
 * still open, and `openFindingGaps` surfaces that record as a blocker right
 * after it. Collapsing the two would delete that blocker.
 */
export const collapseGroupedGaps = ({ gaps }: Params): GradedGap[] =>
	gaps.flatMap((gap) => ((gap.findingId ?? '') === '' ? [gap] : collapseSide({ gap, gaps })));
