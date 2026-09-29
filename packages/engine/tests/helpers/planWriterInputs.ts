import type { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';

/** A minimal verified PlanFacts with distinctive values to spot in the prompt — no assertion on an assembled invocation varies with it. */
export const planFacts = (): PlanFacts => ({
	request: 'add a foo endpoint',
	areas: [],
	verification: { pathsChecked: 0, missingPaths: [], scriptsChecked: 0, missingScripts: [] },
	verifiedAt: '2026-07-09T00:00:00.000Z',
});
