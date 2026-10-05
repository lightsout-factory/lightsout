import { isBlockingGap } from '#src/common/findings/isBlockingGap.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';

interface Params {
	gaps: GradedGap[];
}

/** The verdict reads this rather than `gaps.length`, so a finding the agent can settle never fails a plan by being counted. */
export const getBlockingGaps = ({ gaps }: Params): GradedGap[] => gaps.filter((gap) => isBlockingGap({ gap }));
