import { z } from 'zod';
import { ExploreArea } from '#src/contracts/plan/facts/ExploreArea.ts';
import { PathVerification } from '#src/contracts/plan/facts/PathVerification.ts';

/** The persisted `facts.json` for a plan workspace. */
export const PlanFacts = z.object({
	request: z.string(),
	areas: z.array(ExploreArea).default([]),
	verification: PathVerification,
	verifiedAt: z.string(),
});

export type PlanFacts = z.infer<typeof PlanFacts>;
