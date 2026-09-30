import { z } from 'zod';
import { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import { StandardsPackRuleListing } from '#src/contracts/views/StandardsPackRuleListing.ts';

/** No prose and no fixture text — those arrive one rule at a time. */
export const StandardsPackView = StandardsPackBundle.omit({ rules: true }).extend({
	rules: z.array(StandardsPackRuleListing),
});

export type StandardsPackView = z.infer<typeof StandardsPackView>;
