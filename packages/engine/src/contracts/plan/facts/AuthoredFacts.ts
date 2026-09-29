import { z } from 'zod';
import { ExploreArea } from '#src/contracts/plan/facts/ExploreArea.ts';

/** The session-authored `facts.json`, before `plan verify-facts` rewrites it as a full `PlanFacts`. */
export const AuthoredFacts = z.object({
	request: z.string(),
	areas: z.array(ExploreArea).default([]),
});

export type AuthoredFacts = z.infer<typeof AuthoredFacts>;
