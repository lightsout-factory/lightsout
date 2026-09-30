import { describe, expect, test } from '@jest/globals';
import { ConfigView } from '#src/contracts/views/config/ConfigView.ts';

const setupConfigView = ({ ruleNumbers, source = 'detected' }: { ruleNumbers: Record<string, unknown>; source?: string }) => {
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
		standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', source }],
		ruleStates: [ruleState],
	};

	return { configView };
};

const setupPerPackageConfigView = () => {
	const rootGroup = {
		packages: ['', 'engine'],
		appliesTo: 'repo root (outside packages), engine',
		pack: 'lightsout/node',
		source: 'detected',
	};
	const webAppGroup = { packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/react-app', source: 'named' };
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
	const webAppGroupWithoutAppliesTo = { packages: ['web-app'], pack: 'lightsout/react-app', source: 'named' };
	const perPackageView = buildView([rootGroup, webAppGroup]);
	const withoutAppliesToView = buildView([rootGroup, webAppGroupWithoutAppliesTo]);
	const unknownSourceView = buildView([rootGroup, { ...webAppGroup, source: 'configured' }]);

	return { perPackageView, withoutAppliesToView, unknownSourceView };
};

describe('ConfigView', () => {
	test('accepts per-package standards groups and rule-state packages and refuses a group without appliesTo or with an unknown pack source', () => {
		const { perPackageView, withoutAppliesToView, unknownSourceView } = setupPerPackageConfigView();

		const parsed = ConfigView.parse(perPackageView);
		const withoutAppliesTo = ConfigView.safeParse(withoutAppliesToView);
		const unknownSource = ConfigView.safeParse(unknownSourceView);

		expect({
			standardsGroups: parsed.standardsGroups,
			ruleStateScopes: parsed.ruleStates.map(({ packages, appliesTo }) => ({ packages, appliesTo })),
			withoutAppliesToParsed: withoutAppliesTo.success,
			unknownSourceParsed: unknownSource.success,
		}).toStrictEqual({
			standardsGroups: [
				{
					packages: ['', 'engine'],
					appliesTo: 'repo root (outside packages), engine',
					pack: 'lightsout/node',
					source: 'detected',
				},
				{ packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/react-app', source: 'named' },
			],
			ruleStateScopes: [{ packages: ['', 'engine', 'web-app'], appliesTo: 'repo root (outside packages), engine, web-app' }],
			withoutAppliesToParsed: false,
			unknownSourceParsed: false,
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
		{ source: 'named', parses: true },
		{ source: 'detected', parses: true },
		{ source: 'configured', parses: false },
	])('ConfigView: a standards group source of $source parses: $parses', ({ source, parses }) => {
		const { configView } = setupConfigView({ ruleNumbers: { options: {} }, source });

		const parsed = ConfigView.safeParse(configView);

		expect(parsed.success).toBe(parses);
	});

	test('ConfigView: a view without standardsGroups is refused, and the deleted packs and channels fields are not carried', () => {
		const { configView } = setupConfigView({ ruleNumbers: { options: {} } });
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
			standardsGroups: [{ packages: [''], appliesTo: 'repo root (outside packages)', pack: 'lightsout/node', source: 'detected' }],
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
