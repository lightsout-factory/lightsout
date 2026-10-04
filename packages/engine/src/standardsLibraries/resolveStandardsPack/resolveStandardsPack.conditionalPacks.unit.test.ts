import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { ResolvedStandardsPack } from '#src/common/types/ResolvedStandardsPack.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack/resolveStandardsPack.ts';
import { setupStandardsLibraries } from '#tests/helpers/setupStandardsLibraries.ts';

/** Everything a resolved pack says: its name, topic addresses, each rule's grade, the conditional packs that applied and the rules left inactive. */
const summarizePack = ({ pack }: { pack: ResolvedStandardsPack }) => ({
	name: pack.name,
	topics: pack.topics.map((topic) => `${topic.library}/${topic.path}`),
	rules: pack.rules.map(({ rule, severity, options }) => ({ name: rule.name, severity, options })),
	conditionalPacks: pack.conditionalPacks,
	inactiveRules: pack.inactiveRules.map((rule) => rule.name),
});

interface ResolveParams {
	addresses: string[];
	libraries: LoadedStandardsLibrary[];
	dependencies: ReadonlySet<string> | undefined;
}

const resolveSummary = ({ addresses, libraries, dependencies }: ResolveParams) =>
	summarizePack({ pack: resolveStandardsPack({ addresses, libraries, dependencies }) });

/**
 * An `acme` library with an unconditional `base` pack (rule `tabs`) and a
 * `react` pack that applies only to a package declaring react or preact. The
 * react pack brings `hooks-first` and regrades both rules, so whether it
 * applied shows in `tabs` as well. `app` includes both and sets an option on
 * `hooks-first`; `broken` is conditional and names a rule that does not exist.
 */
const setupConditionalLibraries = () =>
	setupStandardsLibraries({
		libraries: [
			{
				name: 'acme',
				topics: [
					{ path: 'code/base', rules: [{ id: 'tabs', severity: StandardsSeverity.Blocking }] },
					{ path: 'code/react', rules: [{ id: 'hooks-first', severity: StandardsSeverity.Advisory, options: { max: 3 } }] },
				],
				packs: [
					{ name: 'base', topics: ['acme/code/base'] },
					{
						name: 'react',
						topics: ['acme/code/react'],
						rules: ['tabs'],
						ruleSettings: { tabs: 'advisory', 'hooks-first': 'blocking' },
						appliesWhen: { dependencies: ['react', 'preact'] },
					},
					{ name: 'app', packs: ['acme/base', 'acme/react'], ruleSettings: { 'hooks-first': { options: { max: 5 } } } },
					{ name: 'broken', rules: ['ghost-rule'], appliesWhen: { dependencies: ['react'] } },
				],
			},
		],
	});

/** An `acme` library whose packs `a` and `b` grade the one rule `size` differently, each writing options the other does not. */
const setupDisagreeingLibraries = () =>
	setupStandardsLibraries({
		libraries: [
			{
				name: 'acme',
				topics: [{ path: 'code/demo', rules: [{ id: 'size', severity: StandardsSeverity.Off, options: { limit: 100, depth: 3, width: 5 } }] }],
				packs: [
					{ name: 'a', rules: ['size'], ruleSettings: { size: { severity: 'advisory', options: { depth: 4, limit: 50 } } } },
					{ name: 'b', rules: ['size'], ruleSettings: { size: { severity: 'blocking', options: { width: 8, limit: 70 } } } },
				],
			},
		],
	});

describe('resolveStandardsPack', () => {
	test.each<{ when: string; dependencies: ReadonlySet<string> | undefined }>([
		{ when: 'the package declares one of its dependencies', dependencies: new Set(['zod', 'preact']) },
		{ when: 'no dependencies are given', dependencies: undefined },
	])('resolveStandardsPack applies a conditional pack when $when', ({ dependencies }) => {
		const { libraries } = setupConditionalLibraries();

		const summary = resolveSummary({ addresses: ['acme/base', 'acme/react'], libraries, dependencies });

		expect(summary).toStrictEqual({
			name: 'acme/base + acme/react',
			topics: ['acme/code/base', 'acme/code/react'],
			rules: [
				{ name: 'acme/tabs', severity: 'advisory', options: {} },
				{ name: 'acme/hooks-first', severity: 'blocking', options: { max: 3 } },
			],
			conditionalPacks: ['acme/react'],
			inactiveRules: [],
		});
	});

	test('resolveStandardsPack skips a conditional pack whose dependencies the package does not declare, keeping only its own rules as inactive', () => {
		const { libraries } = setupConditionalLibraries();

		const summary = resolveSummary({ addresses: ['acme/base', 'acme/react'], libraries, dependencies: new Set(['zod']) });

		// the react pack's grade for tabs is dropped with it, and tabs is no inactive rule because base still brings it
		expect(summary).toStrictEqual({
			name: 'acme/base + acme/react',
			topics: ['acme/code/base'],
			rules: [{ name: 'acme/tabs', severity: 'blocking', options: {} }],
			conditionalPacks: [],
			inactiveRules: ['acme/hooks-first'],
		});
	});

	test("resolveStandardsPack accepts a pack's rule-settings entry for a rule only an included conditional pack that did not apply brings", () => {
		const { libraries } = setupConditionalLibraries();

		const summary = resolveSummary({ addresses: ['acme/app'], libraries, dependencies: new Set() });

		// app sets an option on hooks-first, which no pack brought for this package: the entry is inert, not an unknown name
		expect(summary).toStrictEqual({
			name: 'acme/app',
			topics: ['acme/code/base'],
			rules: [{ name: 'acme/tabs', severity: 'blocking', options: {} }],
			conditionalPacks: [],
			inactiveRules: ['acme/hooks-first'],
		});
	});

	test('resolveStandardsPack refuses a conditional pack that cannot resolve even when it would not apply', () => {
		const { libraries } = setupConditionalLibraries();

		expect(() => resolveStandardsPack({ addresses: ['acme/base', 'acme/broken'], libraries, dependencies: new Set() })).toThrow(
			/pack acme\/broken: include\.rules entry "ghost-rule"/,
		);
	});

	test('resolveStandardsPack merges several addresses in listed order, the last listed winning, under a name joining them', () => {
		const { libraries } = setupDisagreeingLibraries();
		const orders = [
			['acme/a', 'acme/b'],
			['acme/b', 'acme/a'],
		];

		const summaries = orders.map((addresses) => resolveSummary({ addresses, libraries, dependencies: undefined }));

		// severity is the last listed pack's; options merge key by key, so each keeps what only it wrote
		expect(summaries).toStrictEqual([
			{
				name: 'acme/a + acme/b',
				topics: ['acme/code/demo'],
				rules: [{ name: 'acme/size', severity: 'blocking', options: { limit: 70, depth: 4, width: 8 } }],
				conditionalPacks: [],
				inactiveRules: [],
			},
			{
				name: 'acme/b + acme/a',
				topics: ['acme/code/demo'],
				rules: [{ name: 'acme/size', severity: 'advisory', options: { limit: 50, depth: 4, width: 8 } }],
				conditionalPacks: [],
				inactiveRules: [],
			},
		]);
	});
});
