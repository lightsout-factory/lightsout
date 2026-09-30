import { describe, expect, test } from '@jest/globals';
import { ConfigView } from '#src/contracts/views/config/ConfigView.ts';

const setupConfigView = ({ ruleNumbers }: { ruleNumbers: Record<string, unknown> }) => {
	const ruleState = {
		rule: 'folder-size',
		pack: 'lightsout-defaults',
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
		packs: [{ name: 'lightsout-defaults', rootPath: '/plugin/standards', isDefault: true, channels: [] }],
		channels: [],
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
			ruleStates: [{ rule: 'folder-size', pack: 'lightsout-defaults', channel: 'code', severity: 'blocking', fromConfig: true, options: { cap: 15 } }],
			settingsParsed: false,
		});
	});
});
