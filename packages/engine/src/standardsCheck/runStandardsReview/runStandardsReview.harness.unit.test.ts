import { expect, test } from '@jest/globals';
import type { Driver } from '#src/common/types/Driver.ts';
import type { DriverInvocation } from '#src/common/types/DriverInvocation.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { runStandardsReview } from '#src/standardsCheck/runStandardsReview/runStandardsReview.ts';

// What the review hands the harness about itself — the model and effort the
// config chose — as distinct from what it asks the harness to read, which the
// main suite covers.

const rule: LoadedStandardsRule = {
	id: 'common-placement',
	name: 'acme/common-placement',
	library: 'acme',
	set: 'code',
	documentPath: 'code/architecture/folder-structure',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: false,
	agent: true,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: '/packages/acme/common-placement/fixtures',
};

/** One group whose pack holds the one agent-checked rule, so the review has something to spend an agent on. */
const group: StandardsGroup = {
	packages: [''],
	pack: {
		name: 'acme/house',
		topics: [],
		rules: [{ rule, severity: rule.defaultSeverity, options: rule.defaultOptions, exclude: [] }],
		conditionalPacks: [],
		inactiveRules: [],
	},
	states: new Map<string, ResolvedRuleState>([
		[rule.name, { severity: rule.defaultSeverity, options: rule.defaultOptions, fromConfig: false, reachesAgents: true, packExclude: [], repoExclude: [] }],
	]),
};

/** A stub harness that reports nothing and records the full invocation it was handed. */
const setupDriver = () => {
	const invocations: DriverInvocation[] = [];
	const driver: Driver = {
		name: 'stub',
		invoke: async (invocation) => {
			invocations.push(invocation);

			return { text: JSON.stringify({ findings: [] }), exitCode: 0 };
		},
	};

	return { driver, invocations };
};

test('runStandardsReview: the configured model and effort reach the harness, so the review is not billed on the harness default', async () => {
	const { driver, invocations } = setupDriver();

	await runStandardsReview({ cwd: '/repo', driver, model: 'glm-5.3-flash', effort: 'low', groups: [group], packagesDir: 'packages', files: ['src/a.ts'] });

	expect(invocations[0]).toEqual(expect.objectContaining({ model: 'glm-5.3-flash', effort: 'low' }));
});

test('runStandardsReview: with neither configured, the harness is handed neither, so its own defaults apply', async () => {
	const { driver, invocations } = setupDriver();

	await runStandardsReview({ cwd: '/repo', driver, groups: [group], packagesDir: 'packages', files: ['src/a.ts'] });

	expect({ model: invocations[0]?.model, effort: invocations[0]?.effort }).toStrictEqual({ model: undefined, effort: undefined });
});
