import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { DriverInvocation } from '#src/drivers/common/types/DriverInvocation.ts';
import type { DriverResult } from '#src/drivers/common/types/DriverResult.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { runStandardsReview } from '#src/standardsCheck/runStandardsReview.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';

// What happens to a reported finding the engine cannot keep: which ones are
// dropped, and how each drop is stated. The findings kept are the main suite's
// subject.

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/architecture/folder-structure',
	summary: 'a rule',
	prose: 'the argument for the rule',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

/** One group whose pack holds `rules`, each at its rule.md default. */
const groupOf = ({ rules }: { rules: LoadedStandardsRule[] }): StandardsGroup => ({
	packages: [''],
	pack: {
		name: 'acme/house',
		topics: [],
		rules: rules.map((entry) => ({ rule: entry, severity: entry.defaultSeverity, options: entry.defaultOptions })),
		conditionalPacks: [],
		inactiveRules: [],
	},
	states: new Map<string, ResolvedRuleState>(
		rules.map((entry) => [entry.name, { severity: entry.defaultSeverity, options: entry.defaultOptions, fromConfig: false, reachesAgents: true }]),
	),
});

/** A stub harness answering every invocation with `text`, recording the prompts and the full invocations it was given. */
const setupDriver = ({ result }: { result: DriverResult | (() => DriverResult) }) => {
	const prompts: string[] = [];
	const invocations: DriverInvocation[] = [];
	const driver: Driver = {
		name: 'stub',
		invoke: async (invocation) => {
			prompts.push(invocation.prompt);
			invocations.push(invocation);

			return typeof result === 'function' ? result() : result;
		},
	};

	return { driver, prompts, invocations };
};

const reviewText = (findings: Record<string, unknown>[]) => JSON.stringify({ findings });

describe('runStandardsReview dropped findings', () => {
	test('a finding naming a rule no package declares is dropped, and the drop is stated', async () => {
		const { driver } = setupDriver({
			result: {
				text: reviewText([
					{ rule: 'invented-rule', files: [{ path: 'src/a.ts' }], detail: 'made up' },
					{ rule: 'common-placement', files: [{ path: 'src/b.ts' }], detail: 'real' },
				]),
				exitCode: 0,
			},
		});

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts', 'src/b.ts'],
		});

		expect(findings.map((finding) => finding.rule)).toStrictEqual(['acme/common-placement']);
		expect(notes).toStrictEqual(['agent review: 1 finding(s) dropped — no judgment rule is named invented-rule']);
	});

	test('a finding with no file to point at is dropped — a site key needs a site', async () => {
		const { driver } = setupDriver({ result: { text: reviewText([{ rule: 'common-placement', files: [], detail: 'somewhere in the repo' }]), exitCode: 0 } });

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts'],
		});

		expect(findings).toStrictEqual([]);
		expect(notes).toStrictEqual(['agent review: 1 finding(s) dropped — reported with no file to point at']);
	});

	test('repeated invented rule ids are counted every time but named once, in order', async () => {
		const { driver } = setupDriver({
			result: {
				text: reviewText([
					{ rule: 'zeta-rule', files: [{ path: 'src/a.ts' }], detail: 'made up' },
					{ rule: 'alpha-rule', files: [{ path: 'src/b.ts' }], detail: 'also made up' },
					{ rule: 'zeta-rule', files: [{ path: 'src/c.ts' }], detail: 'made up again' },
				]),
				exitCode: 0,
			},
		});

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
		});

		expect(findings).toStrictEqual([]);
		expect(notes).toStrictEqual(['agent review: 3 finding(s) dropped — no judgment rule is named alpha-rule, zeta-rule']);
	});

	test('both kinds of drop are stated separately when one review does both', async () => {
		const { driver } = setupDriver({
			result: {
				text: reviewText([
					{ rule: 'invented-rule', files: [{ path: 'src/a.ts' }], detail: 'made up' },
					{ rule: 'common-placement', files: [], detail: 'somewhere in the repo' },
					{ rule: 'common-placement', files: [{ path: 'src/b.ts' }], detail: 'real' },
				]),
				exitCode: 0,
			},
		});

		const { findings, notes } = await runStandardsReview({
			cwd: '/repo',
			driver,
			groups: [groupOf({ rules: [rule({ id: 'common-placement' })] })],
			packagesDir: 'packages',
			files: ['src/a.ts', 'src/b.ts'],
		});

		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['acme/common-placement:src/b.ts']);
		expect(notes).toStrictEqual([
			'agent review: 1 finding(s) dropped — no judgment rule is named invented-rule',
			'agent review: 1 finding(s) dropped — reported with no file to point at',
		]);
	});
});
