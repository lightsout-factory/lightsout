import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

export interface AttributedFindings {
	/** Site keys the baseline never carried. */
	introduced: StandardsFinding[];
	/** Site keys the baseline carried, with a larger measure now. */
	worsened: StandardsFinding[];
	/** Site keys the baseline carried, with an equal or smaller measure now. */
	inherited: StandardsFinding[];
	/** No comparison was possible: no baseline, or no measure on both sides. */
	uncertain: StandardsFinding[];
}
