import { z } from 'zod';
import { StandardsPackDocumentView } from '#src/contracts/views/StandardsPackDocumentView.ts';
import { StandardsPackListing } from '#src/contracts/views/StandardsPackListing.ts';
import { StandardsPackRuleView } from '#src/contracts/views/StandardsPackRuleView.ts';

/**
 * Never sent over the wire whole: the listing, the view and the rule view are
 * projections of it. Per-channel counts are worked out from `rules` when the
 * pack is listed, so a stored bundle can never disagree with them.
 */
export const StandardsPackBundle = StandardsPackListing.omit({ channelTotals: true }).extend({
	documents: z.array(StandardsPackDocumentView),
	rules: z.array(StandardsPackRuleView),
});

export type StandardsPackBundle = z.infer<typeof StandardsPackBundle>;
