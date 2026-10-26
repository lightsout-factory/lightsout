import type { StandardsCheckFunction, StandardsCheckInputs, StandardsInputKind } from '@lightsout/standards-contracts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/** One group whose pack holds a single rule of the asked-for kind, plus the recorder of what it was handed. */
export const loadOneRule = ({ inputKinds }: { inputKinds: StandardsInputKind[] }): { handed: StandardsCheckInputs[]; groups: StandardsGroup[] } => {
	const handed: StandardsCheckInputs[] = [];
	const run: StandardsCheckFunction = ({ inputs }) => {
		handed.push(inputs);

		return [];
	};
	const rule: LoadedStandardsRule = {
		id: 'a-rule',
		name: 'acme/a-rule',
		library: 'acme',
		set: 'code',
		documentPath: 'code/style-guide/structure/module-api',
		summary: 'a rule',
		prose: 'the argument for the rule',
		deterministic: true,
		agent: false,
		defaultSeverity: StandardsSeverity.Advisory,
		defaultOptions: {},
		requires: [],
		fixturesPath: '/packages/acme/a-rule/fixtures',
		inputKinds,
		run,
	};
	const states = new Map<string, ResolvedRuleState>([
		['acme/a-rule', { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true, packExclude: [], repoExclude: [] }],
	]);
	const group: StandardsGroup = {
		packages: [''],
		pack: {
			name: 'acme/house',
			topics: [],
			rules: [{ rule, severity: StandardsSeverity.Advisory, options: {}, exclude: [] }],
			conditionalPacks: [],
			inactiveRules: [],
		},
		states,
	};

	return { handed, groups: [group] };
};
