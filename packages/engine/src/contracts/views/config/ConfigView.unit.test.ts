import { describe, expect, test } from '@jest/globals';
import { ConfigView } from '#src/contracts/views/config/ConfigView.ts';

const setupConfigView = ({ ruleNumbers, source = 'detected' }: { ruleNumbers: Record<string, unknown>; source?: string }) => {
	const ruleState = {
		rule: 'lightsout/folder-size',
		id: 'folder-size',
		library: 'lightsout',
		channel: 'code',
		severity: 'blocking',
		fromConfig: true,
		...ruleNumbers,
	};
	const configView = {
		path: '/repo/lightsout.config.json',
		harness: 'claude-code',
		model: null,
		sections: [],
		standardsGroups: [{ packages: [''], pack: 'lightsout/node', source }],
		ruleStates: [ruleState],
	};

	return { configView };
};

describe('ConfigView', () => {
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
					channel: 'code',
					severity: 'blocking',
					fromConfig: true,
					options: { cap: 15 },
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
			standardsGroups: [{ packages: [''], pack: 'lightsout/node', source: 'detected' }],
		});
	});
});
