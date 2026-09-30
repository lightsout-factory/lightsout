import { expect, test } from '@jest/globals';
import { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';

test('StandardsRuleSettings: both override forms come through parsing intact', () => {
	const overrides = {
		'duplicate-code-block': 'off',
		'file-size': { severity: 'advisory', options: { file: 200, tsxFile: 260 } },
	};

	// a bare severity and a full object are both recognized, so neither is
	// stripped as an unknown shape
	expect(StandardsRuleSettings.parse(overrides)).toStrictEqual(overrides);
});

test('StandardsRuleSettings: a rule the map never names is left alone entirely', () => {
	// naming one rule says nothing about the other sixteen — silence is never a change
	expect(StandardsRuleSettings.parse({ 'function-size': { options: { function: 40 } } })).toStrictEqual({ 'function-size': { options: { function: 40 } } });
	// an empty map is valid — every rule already has a default
	expect(StandardsRuleSettings.parse({})).toStrictEqual({});
});

test.each([{ severity: 'blocking' }, { severity: 'advisory' }, { severity: 'off' }])(
	'StandardsRuleSettings: $severity parses as a bare value and inside an override object',
	({ severity }) => {
		// all three states are settable, including off — the only way a repo stops a
		// rule blocking is by naming it here
		expect(StandardsRuleSettings.parse({ 'duplicate-code-block': severity })).toStrictEqual({ 'duplicate-code-block': severity });
		// the object form reaches the same state, so a repo adding options later
		// never has to restate the severity in a different vocabulary
		expect(StandardsRuleSettings.parse({ 'duplicate-code-block': { severity } })).toStrictEqual({ 'duplicate-code-block': { severity } });
	},
);

test('StandardsRuleSettings: an override object may carry severity alone, options alone, or neither', () => {
	const overrides = {
		'duplicate-code-block': { severity: 'advisory' },
		'folder-size': { options: { cap: 30 } },
		'barrel-star': {},
	};

	// both fields are independently optional: severity without options keeps the
	// rule's default knobs, options without severity keeps its default severity,
	// and an empty object changes nothing at all
	expect(StandardsRuleSettings.parse(overrides)).toStrictEqual(overrides);
});

test('StandardsRuleSettings: an option value is checked as a number and nothing more', () => {
	// option keys belong to the rule, not this schema, so a zero or a fraction
	// parses here — whether a value makes sense is the rule's own business
	expect(StandardsRuleSettings.parse({ 'duplicate-code-block': { options: { minTokens: 0, ratio: 1.5 } } })).toStrictEqual({
		'duplicate-code-block': { options: { minTokens: 0, ratio: 1.5 } },
	});
});

test('StandardsRuleSettings: a rule id this schema has never heard of parses, because the packages own the vocabulary', () => {
	// a third-party standards package brings its own rule ids, so a closed list
	// here would refuse every package but the bundled one. The typo `size-fil`
	// is still caught — by `resolveStandardsGroups`, where the selected pack
	// makes the valid ids knowable, and it names the entry in the refusal
	expect(StandardsRuleSettings.parse({ 'house-style-no-default-export': 'off', 'size-fil': 'off' })).toStrictEqual({
		'house-style-no-default-export': 'off',
		'size-fil': 'off',
	});
});

test.each([
	{ label: 'a severity outside the three states', overrides: { 'duplicate-code-block': 'warn' } },
	{ label: 'a severity outside the three states inside an object', overrides: { 'duplicate-code-block': { severity: 'warn' } } },
	{ label: 'an option that is not a number', overrides: { 'duplicate-code-block': { options: { minTokens: '50' } } } },
	{ label: 'an override object carrying a key the shape does not declare', overrides: { 'duplicate-code-block': { severty: 'off' } } },
	{ label: 'an overrides map that is not an object', overrides: true },
])('StandardsRuleSettings: $label fails parsing', ({ overrides }) => {
	// a mistyped severity would silently disable an override the user believes is
	// active — the same reason the commands block is strict
	expect(StandardsRuleSettings.safeParse(overrides).success).toBe(false);
});

type ParseIssue = { code: string; keys?: string[]; errors?: ParseIssue[][] };

// a refusal inside a union sits among the per-branch errors, so walk them all
const collectIssues = ({ issues }: { issues: ParseIssue[] }): ParseIssue[] =>
	issues.flatMap((issue) => [issue, ...(issue.errors ?? []).flatMap((branch) => collectIssues({ issues: branch }))]);

test('StandardsRuleSettings: the object form takes options, and a settings key is refused as unknown', () => {
	const withOptions = { 'folder-size': { severity: 'blocking', options: { cap: 3 } } };
	const withSettings = { 'folder-size': { severity: 'blocking', settings: { cap: 3 } } };

	const parsedOptions = StandardsRuleSettings.parse(withOptions);
	const parsedSettings = StandardsRuleSettings.safeParse(withSettings);

	const unrecognizedKeys = collectIssues({ issues: (parsedSettings.error?.issues ?? []) as ParseIssue[] })
		.filter((issue) => issue.code === 'unrecognized_keys')
		.map((issue) => issue.keys);
	expect({ parsedOptions, settingsParsed: parsedSettings.success, unrecognizedKeys }).toStrictEqual({
		parsedOptions: withOptions,
		settingsParsed: false,
		unrecognizedKeys: [['settings']],
	});
});
