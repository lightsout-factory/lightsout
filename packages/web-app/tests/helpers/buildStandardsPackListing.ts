import type { StandardsPackListing } from '@lightsout/engine';

interface Params {
	name?: string;
	description?: string;
	/** Left out, the pack applies to every package. */
	appliesWhen?: StandardsPackListing['appliesWhen'];
	include?: StandardsPackListing['include'];
	/** Topic addresses the resolved pack brings in. */
	topics?: string[];
	rules?: StandardsPackListing['rules'];
	totals?: Partial<StandardsPackListing['totals']>;
	/** Applied last, so a test can drop an optional field the defaults fill — `{ description: undefined }`. */
	overrides?: Partial<StandardsPackListing>;
}

/** One pack file of the lightsout library, resolved, as the library's view lists it. */
export const buildStandardsPackListing = ({
	name = 'standards',
	description = 'Every bundled standard at once.',
	appliesWhen,
	include = { packs: [], topics: [], rules: [] },
	topics = [],
	rules = [],
	totals = {},
	overrides = {},
}: Params = {}): StandardsPackListing => ({
	name,
	address: `lightsout/${name}`,
	description,
	...(appliesWhen === undefined ? {} : { appliesWhen }),
	include,
	topics,
	rules,
	totals: { rules: rules.length, deterministic: rules.length, agent: 0, topics: topics.length, ...totals },
	...overrides,
});
