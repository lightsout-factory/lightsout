import { z } from 'zod';
import { StandardsPackListing } from '#src/contracts/views/StandardsPackListing.ts';
import { StandardsPackRuleView } from '#src/contracts/views/StandardsPackRuleView.ts';
import { StandardsTopicView } from '#src/contracts/views/StandardsTopicView.ts';

/**
 * One standards library as the pack pages render it. Never sent over the wire
 * whole: the view and the rule view are projections of it. Every pack listing
 * and every total is worked out when the bundle is built, so nothing is derived
 * at listing time.
 */
export const StandardsPackBundle = z.object({
	/** The library's name from its lightsout-standards.json, e.g. 'lightsout'. */
	name: z.string(),
	description: z.string().optional(),
	homepage: z.string().optional(),
	/** Absolute folder the library was read from; the committed asset carries it repo-relative. */
	rootPath: z.string(),
	/** Stripped of its fixtures by the bundler — every rule's fixture counts are zero. */
	built: z.boolean(),
	totals: z.object({
		rules: z.number(),
		deterministic: z.number(),
		agent: z.number(),
		topics: z.number(),
		packs: z.number(),
		/** Rules with at least one pass and one fail fixture file. */
		withFixtures: z.number(),
	}),
	packs: z.array(StandardsPackListing),
	topics: z.array(StandardsTopicView),
	rules: z.array(StandardsPackRuleView),
});

export type StandardsPackBundle = z.infer<typeof StandardsPackBundle>;
