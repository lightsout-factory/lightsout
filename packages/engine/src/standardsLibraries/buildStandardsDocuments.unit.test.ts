import { describe, expect, test } from '@jest/globals';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { buildStandardsDocuments } from '#src/standardsLibraries/buildStandardsDocuments.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';

const buildRule = ({
	id,
	prose,
	defaultSeverity = StandardsSeverity.Advisory,
}: {
	id: string;
	prose: string;
	defaultSeverity?: StandardsSeverity;
}): LoadedStandardsRule => ({
	id,
	name: `lightsout defaults/${id}`,
	library: 'lightsout defaults',
	set: 'code',
	documentPath: 'code/example',
	summary: `${id} summary`,
	prose,
	checked: false,
	defaultSeverity,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/pkg/code/example/${id}/fixtures`,
});

const buildDocument = ({
	path,
	intro,
	ruleIds,
	set = 'code',
}: {
	path: string;
	intro: string;
	ruleIds: string[];
	set?: LoadedStandardsTopic['set'];
}): LoadedStandardsTopic => ({ set, library: 'lightsout defaults', path, intro, ruleIds });

/** A library with two code documents, listed out of path order, plus one tests document. */
const setupPack = (): LoadedStandardsLibrary => ({
	name: 'lightsout defaults',
	formatVersion: 2,
	rootPath: '/pkg',
	documents: [
		buildDocument({ path: 'code/style/patterns', intro: '# Patterns', ruleIds: ['functions', 'classes'] }),
		buildDocument({ path: 'code/architecture', intro: '# Architecture', ruleIds: ['graduation'] }),
		buildDocument({ path: 'tests/unit-testing', intro: '# Unit Testing', ruleIds: ['mock-prefix'], set: 'tests' }),
	],
	rules: [
		buildRule({ id: 'functions', prose: 'Use arrow functions.' }),
		buildRule({ id: 'classes', prose: 'Default to functions.' }),
		buildRule({ id: 'graduation', prose: 'A concept earns its folder.' }),
		buildRule({ id: 'mock-prefix', prose: 'Mocks carry a mock prefix.' }),
	],
	packs: [],
});

/** A library whose one document holds an ordinary rule and a rule it ships off, for repos to opt into. */
const setupOptInPack = (): LoadedStandardsLibrary => ({
	...setupPack(),
	documents: [buildDocument({ path: 'code/modules', intro: '# Modules', ruleIds: ['graduation', 'internal-import'] })],
	rules: [
		buildRule({ id: 'graduation', prose: 'A concept earns its folder.' }),
		buildRule({ id: 'internal-import', prose: 'Private files live in internal/.', defaultSeverity: StandardsSeverity.Off }),
	],
});

/** A library named acme whose one topic holds an ordinary rule and a rule it ships off, each carrying its full name. */
const setupAcmeOptInLibrary = (): LoadedStandardsLibrary => ({
	...setupPack(),
	name: 'acme',
	documents: [{ ...buildDocument({ path: 'code/modules', intro: '# Modules', ruleIds: ['graduation', 'strict'] }), library: 'acme' }],
	rules: [
		{ ...buildRule({ id: 'graduation', prose: 'A concept earns its folder.' }), name: 'acme/graduation', library: 'acme' },
		{ ...buildRule({ id: 'strict', prose: 'Strict mode stays on.', defaultSeverity: StandardsSeverity.Off }), name: 'acme/strict', library: 'acme' },
	],
});

/**
 * One group whose pack brings in every document and rule of `library`, each rule at its rule.md default and
 * reaching agents unless it ships off. `settled` replaces the state of each rule it holds a full name for, as
 * the repo's `standards-rule-settings` resolved it.
 */
const groupOfLibrary = ({ library, settled = {} }: { library: LoadedStandardsLibrary; settled?: Record<string, ResolvedRuleState> }): StandardsGroup => ({
	packages: [''],
	pack: {
		name: `${library.name}/house`,
		topics: library.documents,
		rules: library.rules.map((rule) => ({ rule, severity: rule.defaultSeverity, options: rule.defaultOptions })),
	},
	source: StandardsPackSource.Named,
	states: new Map<string, ResolvedRuleState>(
		library.rules.map((rule) => [
			rule.name,
			settled[rule.name] ?? {
				severity: rule.defaultSeverity,
				options: rule.defaultOptions,
				fromConfig: false,
				reachesAgents: rule.defaultSeverity !== StandardsSeverity.Off,
			},
		]),
	),
});

/** The state of a rule the repo's `standards-rule-settings` named at `severity`, its prose reaching agents. */
const namedState = ({ severity }: { severity: StandardsSeverity }): ResolvedRuleState => ({ severity, options: {}, fromConfig: true, reachesAgents: true });

/** A rule of the built-in lightsout library, carrying its full name. */
const buildLightsoutRule = ({ id, prose }: { id: string; prose: string }): LoadedStandardsRule => ({
	...buildRule({ id, prose }),
	name: `lightsout/${id}`,
	library: 'lightsout',
});

/** A topic of the built-in lightsout library. */
const buildLightsoutTopic = (params: { path: string; intro: string; ruleIds: string[]; set?: LoadedStandardsTopic['set'] }): LoadedStandardsTopic => ({
	...buildDocument(params),
	library: 'lightsout',
});

/** One group covering the repo root, whose pack holds the given topics and rules at the given states. */
const setupGroup = ({
	topics,
	rules,
}: {
	topics: LoadedStandardsTopic[];
	rules: { rule: LoadedStandardsRule; packSeverity?: StandardsSeverity; severity?: StandardsSeverity; reachesAgents?: boolean }[];
}): StandardsGroup => ({
	packages: [''],
	pack: {
		name: 'lightsout/node',
		topics,
		rules: rules.map(({ rule, severity = StandardsSeverity.Advisory, packSeverity = severity }) => ({ rule, severity: packSeverity, options: {} })),
	},
	source: StandardsPackSource.Detected,
	states: new Map(
		rules.map(({ rule, severity = StandardsSeverity.Advisory, reachesAgents = true }) => [
			rule.name,
			{ severity, options: {}, fromConfig: false, reachesAgents },
		]),
	),
});

describe('buildStandardsDocuments', () => {
	test('assembles each document as a header, its intro, then its rule prose in order', () => {
		const pack = setupPack();

		const { code, tests } = buildStandardsDocuments({ groups: [groupOfLibrary({ library: pack })] });

		// the header names the pack and the document folder it came from
		expect(code).toContain('<!-- lightsout defaults: code/architecture -->\n# Architecture\n\nA concept earns its folder.');
		// rule prose follows the intro in ruleIds order, joined by a blank line
		expect(code).toContain('<!-- lightsout defaults: code/style/patterns -->\n# Patterns\n\nUse arrow functions.\n\nDefault to functions.');
		// documents are joined the same way — a blank line between them
		expect(code).toBe(
			'<!-- lightsout defaults: code/architecture -->\n# Architecture\n\nA concept earns its folder.\n\n<!-- lightsout defaults: code/style/patterns -->\n# Patterns\n\nUse arrow functions.\n\nDefault to functions.',
		);
		// each set is assembled on its own
		expect(tests).toBe('<!-- lightsout defaults: tests/unit-testing -->\n# Unit Testing\n\nMocks carry a mock prefix.');
	});

	test('leaves a set out entirely when no document is in play for it', () => {
		const pack = setupPack();
		const codeOnly: LoadedStandardsLibrary = { ...pack, documents: pack.documents.filter((document) => document.set === 'code') };

		const assembled = buildStandardsDocuments({ groups: [groupOfLibrary({ library: codeOnly })] });

		// absent, not an empty string — nothing to inline is not the same as inlining nothing
		expect(assembled.tests).toBe(undefined);
		expect('tests' in assembled).toBeFalsy();
	});

	test('leaves the code set out when only the tests set has a document in play', () => {
		const pack = setupPack();
		const testsOnly: LoadedStandardsLibrary = { ...pack, documents: pack.documents.filter((document) => document.set === 'tests') };

		const assembled = buildStandardsDocuments({ groups: [groupOfLibrary({ library: testsOnly })] });

		expect(assembled.code).toBe(undefined);
		expect('code' in assembled).toBeFalsy();
		expect(assembled.tests).toBe('<!-- lightsout defaults: tests/unit-testing -->\n# Unit Testing\n\nMocks carry a mock prefix.');
	});

	test('sorts documents by path and keeps two documents sharing a path in the order given', () => {
		const pack = setupPack();
		const scrambled: LoadedStandardsLibrary = {
			...pack,
			documents: [
				buildDocument({ path: 'code/b', intro: '# B', ruleIds: ['functions'] }),
				buildDocument({ path: 'code/a', intro: '# A', ruleIds: ['classes'] }),
				buildDocument({ path: 'code/b', intro: '# B again', ruleIds: ['graduation'] }),
			],
		};

		const { code } = buildStandardsDocuments({ groups: [groupOfLibrary({ library: scrambled })] });

		// 'code/a' moves ahead of both 'code/b' documents; the tied pair holds its original order
		expect(code).toBe(
			'<!-- lightsout defaults: code/a -->\n# A\n\nDefault to functions.\n\n<!-- lightsout defaults: code/b -->\n# B\n\nUse arrow functions.\n\n<!-- lightsout defaults: code/b -->\n# B again\n\nA concept earns its folder.',
		);
	});

	test('skips a rule id the pack has no rule for rather than leaving a gap', () => {
		const pack = setupPack();
		const dangling: LoadedStandardsLibrary = {
			...pack,
			documents: [buildDocument({ path: 'code/dangling', intro: '# Dangling', ruleIds: ['missing', 'graduation'] })],
		};

		const { code } = buildStandardsDocuments({ groups: [groupOfLibrary({ library: dangling })] });

		// the unknown id contributes nothing — no blank line, no placeholder
		expect(code).toBe('<!-- lightsout defaults: code/dangling -->\n# Dangling\n\nA concept earns its folder.');
	});

	test('drops empty prose rather than opening a document with blank lines', () => {
		const pack = setupPack();
		const sparse: LoadedStandardsLibrary = {
			...pack,
			documents: [buildDocument({ path: 'code/sparse', intro: '', ruleIds: ['blank', 'graduation'] })],
			rules: [buildRule({ id: 'blank', prose: '' }), buildRule({ id: 'graduation', prose: 'A concept earns its folder.' })],
		};

		const { code } = buildStandardsDocuments({ groups: [groupOfLibrary({ library: sparse })] });

		// an intro-less document starts at its first rule, with no leading blank line
		expect(code).toBe('<!-- lightsout defaults: code/sparse -->\nA concept earns its folder.');
	});

	test("leaves out an opt-in rule's prose while the repo's config never names it", () => {
		const pack = setupOptInPack();

		const { code } = buildStandardsDocuments({ groups: [groupOfLibrary({ library: pack })] });

		expect(code).toBe('<!-- lightsout defaults: code/modules -->\n# Modules\n\nA concept earns its folder.');
	});

	test('includes an opt-in rule once the repo names it, at any severity', () => {
		const pack = setupOptInPack();

		const optedIn = buildStandardsDocuments({
			groups: [groupOfLibrary({ library: pack, settled: { 'lightsout defaults/internal-import': namedState({ severity: StandardsSeverity.Blocking }) } })],
		});
		// off from the repo means its own linter enforces the rule: the standard still holds
		const lintedElsewhere = buildStandardsDocuments({
			groups: [groupOfLibrary({ library: pack, settled: { 'lightsout defaults/internal-import': namedState({ severity: StandardsSeverity.Off }) } })],
		});

		expect(optedIn.code).toContain('Private files live in internal/.');
		expect(lintedElsewhere.code).toContain('Private files live in internal/.');
	});

	test('keeps the prose of a rule the repo turned off, when the pack ships it on', () => {
		const pack = setupPack();

		const { code } = buildStandardsDocuments({
			groups: [groupOfLibrary({ library: pack, settled: { 'lightsout defaults/graduation': namedState({ severity: StandardsSeverity.Off }) } })],
		});

		expect(code).toContain('A concept earns its folder.');
	});

	test.each([
		{ named: 'strict', reaches: true },
		{ named: 'acme/strict', reaches: true },
		{ named: 'acme/graduation', reaches: false },
	])('a publisher-off rule named by its full name or its short id reaches the prose', ({ named, reaches }) => {
		const pack = setupAcmeOptInLibrary();
		// the repo's entry resolves the way every standards-rule-settings key does, then settles the one rule it reaches
		const resolved = resolveRuleName({ name: named, rules: pack.rules });
		const settled = 'rule' in resolved ? { [resolved.rule.name]: namedState({ severity: StandardsSeverity.Blocking }) } : {};

		const { code } = buildStandardsDocuments({ groups: [groupOfLibrary({ library: pack, settled })] });

		expect((code ?? '').includes('Strict mode stays on.')).toBe(reaches);
	});

	test('buildStandardsDocuments: each group topic renders into its own set with its library and path line', () => {
		const group = setupGroup({
			topics: [
				buildLightsoutTopic({ path: 'code/architecture', intro: '# Architecture', ruleIds: ['graduation'] }),
				buildLightsoutTopic({ path: 'code/style/patterns', intro: '# Patterns', ruleIds: ['functions', 'classes'] }),
				buildLightsoutTopic({ path: 'tests/unit-testing', intro: '# Unit Testing', ruleIds: ['mock-prefix'], set: 'tests' }),
			],
			rules: [
				{ rule: buildLightsoutRule({ id: 'graduation', prose: 'A concept earns its folder.' }) },
				{ rule: buildLightsoutRule({ id: 'functions', prose: 'Use arrow functions.' }) },
				{ rule: buildLightsoutRule({ id: 'classes', prose: 'Default to functions.' }) },
				{ rule: { ...buildLightsoutRule({ id: 'mock-prefix', prose: 'Mocks carry a mock prefix.' }), set: 'tests' } },
			],
		});

		const assembled = buildStandardsDocuments({ groups: [group] });

		expect(assembled).toStrictEqual({
			code: '<!-- lightsout: code/architecture -->\n# Architecture\n\nA concept earns its folder.\n\n<!-- lightsout: code/style/patterns -->\n# Patterns\n\nUse arrow functions.\n\nDefault to functions.',
			tests: '<!-- lightsout: tests/unit-testing -->\n# Unit Testing\n\nMocks carry a mock prefix.',
		});
	});

	test('buildStandardsDocuments: prose follows reachesAgents, not severity', () => {
		const group = setupGroup({
			topics: [
				buildLightsoutTopic({ path: 'code/modules', intro: '# Modules', ruleIds: ['graduation', 'internal-import', 'linted'] }),
				buildLightsoutTopic({ path: 'code/opt-in', intro: '# Opt In', ruleIds: ['strict'] }),
			],
			rules: [
				{ rule: buildLightsoutRule({ id: 'graduation', prose: 'A concept earns its folder.' }) },
				// the pack ships it off and the repo never turned it on
				{
					rule: buildLightsoutRule({ id: 'internal-import', prose: 'Private files live in internal/.' }),
					severity: StandardsSeverity.Off,
					reachesAgents: false,
				},
				// the pack runs it and the repo turned it off: its own linter enforces the rule
				{
					rule: buildLightsoutRule({ id: 'linted', prose: 'Its own linter enforces this.' }),
					packSeverity: StandardsSeverity.Blocking,
					severity: StandardsSeverity.Off,
					reachesAgents: true,
				},
				{ rule: buildLightsoutRule({ id: 'strict', prose: 'Strict mode stays on.' }), severity: StandardsSeverity.Off, reachesAgents: false },
			],
		});

		const { code } = buildStandardsDocuments({ groups: [group] });

		expect(code).toBe(
			'<!-- lightsout: code/modules -->\n# Modules\n\nA concept earns its folder.\n\nIts own linter enforces this.\n\n<!-- lightsout: code/opt-in -->\n# Opt In',
		);
	});

	test.each([
		{
			groups: [
				setupGroup({
					// the library also holds code/architecture/react and tests/unit-testing, which lightsout/node leaves out
					topics: [buildLightsoutTopic({ path: 'code/architecture', intro: '# Architecture', ruleIds: ['graduation'] })],
					rules: [{ rule: buildLightsoutRule({ id: 'graduation', prose: 'A concept earns its folder.' }) }],
				}),
			],
			expected: { code: '<!-- lightsout: code/architecture -->\n# Architecture\n\nA concept earns its folder.' },
		},
		{ groups: [], expected: {} },
	])("buildStandardsDocuments: only the pack's own topics render, and an empty set or no group renders nothing", ({ groups, expected }) => {
		const assembled = buildStandardsDocuments({ groups });

		expect(assembled).toStrictEqual(expected);
	});
});
