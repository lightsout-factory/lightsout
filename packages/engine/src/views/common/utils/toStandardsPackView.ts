import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import type { StandardsPackView } from '#src/contracts/views/StandardsPackView.ts';
import { toStandardsPackListing } from '#src/views/common/utils/toStandardsPackListing.ts';
import { toStandardsPackRuleListing } from '#src/views/internal/common/utils/toStandardsPackRuleListing.ts';

interface Params {
	bundle: StandardsPackBundle;
}

/** Prose and fixture text stay behind: the default pack's fixtures run to megabytes and would dwarf the server-rendered page. */
export const toStandardsPackView = ({ bundle }: Params): StandardsPackView => ({
	...toStandardsPackListing({ bundle }),
	documents: bundle.documents,
	rules: bundle.rules.map((rule) => toStandardsPackRuleListing({ rule, fixtureCounts: rule.fixtureCounts })),
});
