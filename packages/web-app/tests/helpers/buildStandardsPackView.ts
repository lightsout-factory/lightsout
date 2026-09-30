import type { StandardsPackListing, StandardsPackRuleListing, StandardsPackView, StandardsTopicView } from '@lightsout/engine';
import { StandardsSet } from '@lightsout/engine/contracts';
import { buildStandardsPackListing } from '#tests/helpers/buildStandardsPackListing.ts';
import { buildStandardsPackRuleListing } from '#tests/helpers/buildStandardsPackRuleListing.ts';

/** One topic per distinct `documentPath` the rules name, each holding its own rules in order. */
const buildTopics = ({ rules }: { rules: StandardsPackRuleListing[] }) =>
	[...new Set(rules.map((rule) => rule.documentPath))].map(
		(path): StandardsTopicView => ({
			set: rules.find((rule) => rule.documentPath === path)?.set ?? StandardsSet.Code,
			path,
			intro: `What ${path} argues.`,
			ruleIds: rules.filter((rule) => rule.documentPath === path).map((rule) => rule.id),
		}),
	);

/** One pack holding every rule and topic, each rule at its default severity and options. */
const buildPacks = ({ rules, topics }: { rules: StandardsPackRuleListing[]; topics: StandardsTopicView[] }) => {
	const checked = rules.filter((rule) => rule.checked).length;

	return [
		buildStandardsPackListing({
			topics: topics.map((topic) => `lightsout/${topic.path}`),
			rules: rules.map((rule) => ({ name: rule.name, severity: rule.defaultSeverity, options: rule.defaultOptions })),
			totals: { checked, judgment: rules.length - checked },
		}),
	];
};

interface Params {
	rules?: StandardsPackRuleListing[];
	/** Left out, one topic per distinct `documentPath` across the rules. */
	topics?: StandardsTopicView[];
	/** Left out, one `node` pack holding every rule. */
	packs?: StandardsPackListing[];
	/** Applied last, so a test can drop an optional field the defaults fill. */
	overrides?: Partial<StandardsPackView>;
}

/** The lightsout library as its pages show it: its packs, its topics, and every rule's row. */
export const buildStandardsPackView = ({
	rules = [buildStandardsPackRuleListing()],
	topics = buildTopics({ rules }),
	packs = buildPacks({ rules, topics }),
	overrides = {},
}: Params = {}): StandardsPackView => {
	const checked = rules.filter((rule) => rule.checked).length;

	return {
		name: 'lightsout',
		description: 'The rules lightsout ships.',
		rootPath: 'packages/lightsout-standards',
		built: false,
		totals: {
			rules: rules.length,
			checked,
			judgment: rules.length - checked,
			topics: topics.length,
			packs: packs.length,
			withFixtures: rules.filter((rule) => rule.fixtureCounts.pass > 0 && rule.fixtureCounts.fail > 0).length,
		},
		packs,
		topics,
		rules,
		...overrides,
	};
};
