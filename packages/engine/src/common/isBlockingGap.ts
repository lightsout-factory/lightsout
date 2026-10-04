import { GapOutcome } from '#src/contracts/plan/grade/GapOutcome.ts';
import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';

interface Params {
	gap: GradedGap;
}

export const isBlockingGap = ({ gap }: Params): boolean => gap.outcome === GapOutcome.NeedsAHuman || gap.outcome === GapOutcome.Unjudged;
