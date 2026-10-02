import { describe, expect, test } from '@jest/globals';
import { ConfigView } from '#src/contracts/views/config/ConfigView.ts';

/** A one-group view; `group` is spread over the group, so a case can replace or add a field of it. */
const setupConfigView = ({ ruleNumbers, group = {} }: { ruleNumbers: Record<string, unknown>; group?: Record<string, unknown> }) => {
	const ruleState = {
		rule: 'lightsout/folder-size',
		id: 'folder-size',
		library: 'lightsout',
		severity: 'blocking',
		fromConfig: true,
		packages: [''],
		appliesTo: 'repo root (outside packages)',
		...ruleNumbers,
	};
	const configView = {
		path: '/repo/lightsout.config.json',
		harness: 'claude-code',
		model: null,
		sections: [],
		standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', conditionalPacks: [], ...group }],
		ruleStates: [ruleState],
	};

	return { configView };
};

const setupPerPackageConfigView = () => {
	const rootGroup = {
		packages: ['', 'engine'],
		appliesTo: 'repo root (outside packages), engine',
		pack: 'lightsout/node + lightsout/react',
		conditionalPacks: [],
	};
	const webAppGroup = { packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/node + lightsout/react', conditionalPacks: ['lightsout/react'] };
	const ruleState = {
		rule: 'lightsout/folder-size',
		id: 'folder-size',
		library: 'lightsout',
		severity: 'blocking',
		fromConfig: false,
		options: { cap: 15 },
		packages: ['', 'engine', 'web-app'],
		appliesTo: 'repo root (outside packages), engine, web-app',
	};
	const buildView = (standardsGroups: Record<string, unknown>[]) => ({
		path: '/repo/lightsout.config.json',
		harness: 'claude-code',
		model: null,
		sections: [],
		standardsGroups,
		ruleStates: [ruleState],
	});
	const webAppGroupWithoutAppliesTo = { packages: ['web-app'], pack: 'lightsout/node + lightsout/react', conditionalPacks: ['lightsout/react'] };
	const webAppGroupWithoutConditionalPacks = { packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/node + lightsout/react' };
	const perPackageView = buildView([rootGroup, webAppGroup]);
	const withoutAppliesToView = buildView([rootGroup, webAppGroupWithoutAppliesTo]);
	const withoutConditionalPacksView = buildView([rootGroup, webAppGroupWithoutConditionalPacks]);

	return { perPackageView, withoutAppliesToView, withoutConditionalPacksView };
};

describe('ConfigView', () => {
	test('accepts per-package standards groups and rule-state packages and refuses a group without appliesTo or without conditionalPacks', () => {
		const { perPackageView, withoutAppliesToView, withoutConditionalPacksView } = setupPerPackageConfigView();

		const parsed = ConfigView.parse(perPackageView);
		const withoutAppliesTo = ConfigView.safeParse(withoutAppliesToView);
		const withoutConditionalPacks = ConfigView.safeParse(withoutConditionalPacksView);

		expect({
			standardsGroups: parsed.standardsGroups,
			ruleStateScopes: parsed.ruleStates.map(({ packages, appliesTo }) => ({ packages, appliesTo })),
			withoutAppliesToParsed: withoutAppliesTo.success,
			withoutConditionalPacksParsed: withoutConditionalPacks.success,
		}).toStrictEqual({
			standardsGroups: [
				{
					packages: ['', 'engine'],
					appliesTo: 'repo root (outside packages), engine',
					pack: 'lightsout/node + lightsout/react',
					conditionalPacks: [],
				},
				{ packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/node + lightsout/react', conditionalPacks: ['lightsout/react'] },
			],
			ruleStateScopes: [{ packages: ['', 'engine', 'web-app'], appliesTo: 'repo root (outside packages), engine, web-app' }],
			withoutAppliesToParsed: false,
			withoutConditionalPacksParsed: false,
		});
	});

	test('ConfigView: a rule state needs options, and settings does not stand in for them', () => {
		const { configView: withOptions } = setupConfigView({ ruleNumbers: { options: { cap: 15 } } });
		const { configView: withSettingsOnly } = setupConfigView({ ruleNumbers: { settings: { cap: 15 } } });

		const parsedOptions = ConfigView.parse(withOptions);
		const parsedSettings = ConfigView.safeParse(withSettingsOnly);

		expect({ ruleStates: parsedOptions.ruleStates, settingsParsed: parsedSettings.success }).toStrictEqual({
			ruleStates: [
				{
					rule: 'lightsout/folder-size',
					id: 'folder-size',
					library: 'lightsout',
					severity: 'blocking',
					fromConfig: true,
					options: { cap: 15 },
					packages: [''],
					appliesTo: 'repo root (outside packages)',
				},
			],
			settingsParsed: false,
		});
	});

	test.each([
		{ conditionalPacks: [], parses: true },
		{ conditionalPacks: ['lightsout/react', 'lightsout/nestjs'], parses: true },
		{ conditionalPacks: 'lightsout/react', parses: false },
		{ conditionalPacks: [7], parses: false },
	])('ConfigView: a standards group whose conditionalPacks is $conditionalPacks parses: $parses', ({ conditionalPacks, parses }) => {
		const { configView } = setupConfigView({ ruleNumbers: { options: {} }, group: { conditionalPacks } });

		const parsed = ConfigView.safeParse(configView);

		expect(parsed.success).toBe(parses);
	});

	test('ConfigView: a view without standardsGroups is refused, and the deleted packs, channels and group source fields are not carried', () => {
		const { configView } = setupConfigView({ ruleNumbers: { options: {} }, group: { source: 'detected' } });
		const withoutGroups = Object.fromEntries(Object.entries(configView).filter(([key]) => key !== 'standardsGroups'));

		const missingGroups = ConfigView.safeParse(withoutGroups);
		const withOldFields = ConfigView.parse({ ...configView, packs: [], channels: ['react'] });

		expect({
			missingGroupsParsed: missingGroups.success,
			carriesPacks: Object.hasOwn(withOldFields, 'packs'),
			carriesChannels: Object.hasOwn(withOldFields, 'channels'),
			standardsGroups: withOldFields.standardsGroups,
		}).toStrictEqual({
			missingGroupsParsed: false,
			carriesPacks: false,
			carriesChannels: false,
			standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', conditionalPacks: [] }],
		});
	});

	test('ConfigView: a rule state handed a leftover channel parses without it', () => {
		const { configView } = setupConfigView({ ruleNumbers: { options: {}, channel: 'code' } });

		const parsed = ConfigView.parse(configView);

		expect(parsed.ruleStates.map((state) => ({ rule: state.rule, carriesChannel: Object.hasOwn(state, 'channel') }))).toStrictEqual([
			{ rule: 'lightsout/folder-size', carriesChannel: false },
		]);
	});
});
