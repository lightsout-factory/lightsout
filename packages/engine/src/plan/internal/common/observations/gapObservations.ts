import type { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';

interface Params {
	/** A judged gap, or a memory record, which reads the same way. */
	gap: GapObservation & Pick<GradedGap, 'observations'>;
}

/** An empty list means a single reader's finding, which still stands for its own location; reading it as "nothing" would drop that location from the record it joins. */
export const gapObservations = ({ gap }: Params): GapObservation[] =>
	gap.observations.length > 0
		? gap.observations
		: [{ phase: gap.phase, lens: gap.lens, area: gap.area, gap: gap.gap, decision: gap.decision, options: gap.options }];
