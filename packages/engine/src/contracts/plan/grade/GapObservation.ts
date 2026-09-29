import { z } from 'zod';
import { GapCheckLens } from '#src/contracts/plan/grade/GapCheckLens.ts';
import { PlanGap } from '#src/contracts/plan/grade/PlanGap.ts';

export const GapObservation = PlanGap.extend({
	/** The plan file's basename — `phase2-cross-phase-checks.md`, or `plan.md`. */
	phase: z.string(),
	/**
	 * Optional because a finding no per-file lens produced, such as the whole-plan
	 * documentation checker's, must not claim a lens it was never given.
	 */
	lens: z.enum(GapCheckLens).optional(),
});

export type GapObservation = z.infer<typeof GapObservation>;
