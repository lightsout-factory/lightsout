import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';

interface Params {
	pack: string;
	rules: LoadedStandardsRule[];
	topicRuleIds: string[];
}

/**
 * One group whose pack brings in exactly `rules`, each at its rule.md default.
 * The topic lists `topicRuleIds`, so a library rule the pack leaves out can
 * still sit in a topic the pack includes.
 */
export const packStandardsGroup = ({ pack, rules, topicRuleIds }: Params): StandardsGroup => ({
	packages: [''],
	pack: {
		name: pack,
		topics: [
			{
				set: 'code',
				library: 'acme',
				path: 'code/architecture/folder-structure',
				intro: '# Folder Structure',
				ruleIds: topicRuleIds,
			},
		],
		rules: rules.map((entry) => ({ rule: entry, severity: entry.defaultSeverity, options: entry.defaultOptions })),
		conditionalPacks: [],
		inactiveRules: [],
	},
	states: new Map<string, ResolvedRuleState>(
		rules.map((entry) => [entry.name, { severity: entry.defaultSeverity, options: entry.defaultOptions, fromConfig: false, reachesAgents: true }]),
	),
});
