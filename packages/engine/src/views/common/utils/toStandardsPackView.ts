import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import type { StandardsPackView } from '#src/contracts/views/StandardsPackView.ts';
import { toStandardsPackRuleListing } from '#src/views/internal/common/utils/toStandardsPackRuleListing.ts';

interface Params {
	bundle: StandardsPackBundle;
}

/**
 * Prose and fixture text stay behind: the built-in library's fixtures run to
 * megabytes and would dwarf the server-rendered page. Fields are named one by
 * one rather than spread, so a field added to the bundle never reaches the wire
 * by accident.
 */
export const toStandardsPackView = ({ bundle }: Params): StandardsPackView => ({
	name: bundle.name,
	...(bundle.description === undefined ? {} : { description: bundle.description }),
	...(bundle.homepage === undefined ? {} : { homepage: bundle.homepage }),
	rootPath: bundle.rootPath,
	built: bundle.built,
	totals: bundle.totals,
	packs: bundle.packs,
	topics: bundle.topics,
	rules: bundle.rules.map((rule) => toStandardsPackRuleListing({ rule, fixtureCounts: rule.fixtureCounts })),
});
