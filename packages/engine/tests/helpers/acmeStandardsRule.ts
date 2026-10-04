import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/** A rule of the `acme` library, advisory by default and read by an agent unless it is deterministic; `overrides` win over every field. */
export const acmeStandardsRule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/architecture/folder-structure',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: false,
	agent: overrides.deterministic !== true,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});
