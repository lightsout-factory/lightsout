import { describe, expect, test } from '@jest/globals';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolvePackageRuleStates } from '#src/standardsCheck/resolvePackageRuleStates.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/style-guide/structure/module-api',
	summary: 'a rule',
	prose: 'the argument for the rule',
	channel: 'base',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	fixturesPath: `/packages/acme/${overrides.id}/fixtures`,
	...overrides,
});

const standardsPack = ({
	name = 'acme',
	rootPath = `/packages/${name}`,
	rules,
}: {
	name?: string;
	rootPath?: string;
	rules: LoadedStandardsRule[];
}): LoadedStandardsLibrary => ({
	name,
	formatVersion: 1,
	rootPath,
	documents: [],
	rules,
});

const baseConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false as const } };

const setupStates = ({ packs, standardsChecks }: { packs: LoadedStandardsLibrary[]; standardsChecks?: Record<string, unknown> }) => {
	const config = LightsoutConfig.parse(standardsChecks === undefined ? baseConfig : { ...baseConfig, 'standards-rule-settings': standardsChecks });

	return { states: resolvePackageRuleStates({ packs, config }) };
};

const twoRules = [
	rule({ id: 'duplicate-code-block', defaultSeverity: StandardsSeverity.Advisory, defaultOptions: { minTokens: 50 } }),
	rule({ id: 'module-boundary', defaultSeverity: StandardsSeverity.Blocking }),
];

describe('resolvePackageRuleStates', () => {
	test('a rule the config never names keeps the severity and options its own front matter declared', () => {
		const { states } = setupStates({ packs: [standardsPack({ rules: twoRules })] });

		expect(states.get('acme/duplicate-code-block')).toStrictEqual({ severity: StandardsSeverity.Advisory, options: { minTokens: 50 }, fromConfig: false });
		expect(states.get('acme/module-boundary')).toStrictEqual({ severity: StandardsSeverity.Blocking, options: {}, fromConfig: false });
	});

	test('a bare severity string replaces the severity and leaves the options alone', () => {
		const { states } = setupStates({ packs: [standardsPack({ rules: twoRules })], standardsChecks: { 'duplicate-code-block': 'off' } });

		expect(states.get('acme/duplicate-code-block')).toStrictEqual({ severity: StandardsSeverity.Off, options: { minTokens: 50 }, fromConfig: true });
	});

	test('an object override merges its options over the front matter rather than replacing them', () => {
		const { states } = setupStates({
			packs: [standardsPack({ rules: [rule({ id: 'file-size', defaultSeverity: StandardsSeverity.Blocking, defaultOptions: { file: 250, tsxFile: 300 } })] })],
			standardsChecks: { 'file-size': { options: { file: 400 } } },
		});

		expect(states.get('acme/file-size')).toStrictEqual({ severity: StandardsSeverity.Blocking, options: { file: 400, tsxFile: 300 }, fromConfig: true });
	});

	test("an object override merges its options over the rule's default options key by key", () => {
		const { states } = setupStates({
			packs: [
				standardsPack({
					rules: [
						rule({ id: 'file-size', defaultSeverity: StandardsSeverity.Blocking, defaultOptions: { file: 250, tsxFile: 300 } }),
						rule({ id: 'folder-size', defaultSeverity: StandardsSeverity.Blocking, defaultOptions: { cap: 20 } }),
					],
				}),
			],
			standardsChecks: { 'file-size': { options: { tsxFile: 400 } }, 'folder-size': 'advisory' },
		});

		const resolved = { fileSize: states.get('acme/file-size'), folderSize: states.get('acme/folder-size') };

		expect(resolved).toStrictEqual({
			fileSize: { severity: StandardsSeverity.Blocking, options: { file: 250, tsxFile: 400 }, fromConfig: true },
			folderSize: { severity: StandardsSeverity.Advisory, options: { cap: 20 }, fromConfig: true },
		});
	});

	test('an override carrying both a severity and options applies both', () => {
		const { states } = setupStates({
			packs: [standardsPack({ rules: twoRules })],
			standardsChecks: { 'duplicate-code-block': { severity: 'blocking', options: { minTokens: 80 } } },
		});

		expect(states.get('acme/duplicate-code-block')).toStrictEqual({ severity: StandardsSeverity.Blocking, options: { minTokens: 80 }, fromConfig: true });
	});

	test('an empty object override changes nothing but still marks the rule as named by the config', () => {
		const { states } = setupStates({ packs: [standardsPack({ rules: twoRules })], standardsChecks: { 'duplicate-code-block': {} } });

		// `--list` prints "(config)" from this flag, so naming a rule at all has to show up there
		expect(states.get('acme/duplicate-code-block')).toStrictEqual({ severity: StandardsSeverity.Advisory, options: { minTokens: 50 }, fromConfig: true });
	});

	test('the resolved options are a copy, so editing them cannot reach back into the loaded pack', () => {
		const rules = [rule({ id: 'duplicate-code-block', defaultOptions: { minTokens: 50 } })];
		const { states } = setupStates({ packs: [standardsPack({ rules })] });
		const resolved = states.get('acme/duplicate-code-block')?.options ?? {};

		resolved.minTokens = 999;

		expect(rules[0]?.defaultOptions).toStrictEqual({ minTokens: 50 });
	});

	test('rules from several packs all get a state', () => {
		const states = resolvePackageRuleStates({
			packs: [
				standardsPack({ rules: twoRules }),
				standardsPack({ name: 'house-style', rules: [rule({ id: 'no-default-export', name: 'house-style/no-default-export', library: 'house-style' })] }),
			],
		});

		expect([...states.keys()].sort()).toStrictEqual(['acme/duplicate-code-block', 'acme/module-boundary', 'house-style/no-default-export']);
		expect([...states.values()].every((state) => state.fromConfig === false)).toBe(true);
	});

	test('two packs claiming one rule id is refused, naming both', () => {
		const packs = [standardsPack({ rules: twoRules }), standardsPack({ rootPath: '/packages/acme-copy', rules: [rule({ id: 'duplicate-code-block' })] })];

		// ambiguous names would make config overrides and site keys mean two things
		expect(() => resolvePackageRuleStates({ packs })).toThrow(/duplicate rule name "acme\/duplicate-code-block".*\/packages\/acme\).*\/packages\/acme-copy\)/);
	});

	test('a config naming a rule no pack declares is refused, with the valid ids listed', () => {
		expect(() => setupStates({ packs: [standardsPack({ rules: twoRules })], standardsChecks: { 'duplicate-code-block-detector': 'off' } })).toThrow(
			/standards-rule-settings names "duplicate-code-block-detector".*valid rule names: acme\/duplicate-code-block, acme\/module-boundary/,
		);
	});

	test('resolves every rule to its own default when the repo has no config at all', () => {
		const states = resolvePackageRuleStates({ packs: [standardsPack({ rules: twoRules })] });

		expect(states.size).toBe(2);
		expect(states.get('acme/duplicate-code-block')?.fromConfig).toBe(false);
	});

	test.each([{ key: 'size' }, { key: 'acme/size' }])('states are keyed by full name and a config key may be the full name or a unique short id', ({ key }) => {
		const { states } = setupStates({
			packs: [standardsPack({ rules: [rule({ id: 'size', name: 'acme/size', library: 'acme', defaultSeverity: StandardsSeverity.Advisory })] })],
			standardsChecks: { [key]: 'off' },
		});

		const resolved = { keys: [...states.keys()], size: states.get('acme/size') };

		expect(resolved).toStrictEqual({ keys: ['acme/size'], size: { severity: StandardsSeverity.Off, options: {}, fromConfig: true } });
	});

	test('a short config key two libraries share throws naming every full candidate', () => {
		const packs = [
			standardsPack({ rules: [rule({ id: 'size', name: 'acme/size', library: 'acme' })] }),
			standardsPack({ name: 'house', rules: [rule({ id: 'size', name: 'house/size', library: 'house' })] }),
		];

		expect(() => setupStates({ packs, standardsChecks: { size: 'off' } })).toThrow(/acme\/size[\s\S]*house\/size/);
	});

	test('two config keys naming one rule throw naming both keys', () => {
		const packs = [standardsPack({ rules: [rule({ id: 'size', name: 'acme/size', library: 'acme' })] })];

		expect(() => setupStates({ packs, standardsChecks: { size: 'off', 'acme/size': 'blocking' } })).toThrow(
			/^(?=[\s\S]*(?<![\w/-])size(?![\w/-]))(?=[\s\S]*acme\/size)/,
		);
	});

	test('a config key matching no loaded rule throws listing the valid full names', () => {
		const packs = [standardsPack({ rules: [rule({ id: 'size', name: 'acme/size', library: 'acme' })] })];

		expect(() => setupStates({ packs, standardsChecks: { 'acme/nope': 'off' } })).toThrow(/standards-rule-settings[\s\S]*acme\/nope[\s\S]*acme\/size/);
	});
});
