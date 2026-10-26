import { describe, expect, test } from '@jest/globals';
import { StandardsPackFile } from '#src/contracts/StandardsPackFile.ts';

const setupPackFiles = () => {
	const packWithoutDescription = {
		include: {
			packs: ['lightsout/standards'],
			topics: ['acme/code/architecture/services'],
			rules: ['acme/no-default-export', 'file-size'],
		},
		'rule-settings': {
			'duplicate-code-block': 'off',
			'file-size': { severity: 'advisory', options: { file: 200, tsxFile: 260 } },
		},
		'applies-when': { dependencies: ['react', 'preact'] },
	};
	const fullPack = { description: 'House TypeScript style on top of the lightsout standards pack.', ...packWithoutDescription };
	const packWithUnknownKey = { ...fullPack, rules: ['file-size'] };

	return { fullPack, packWithoutDescription, packWithUnknownKey };
};

const setupExcludePacks = () => {
	const { fullPack } = setupPackFiles();
	const packWithExclude = {
		...fullPack,
		'rule-settings': { 'file-size': { severity: 'advisory', exclude: ['src/routes/**'] } },
	};
	const packWithNegatedExclude = {
		...fullPack,
		'rule-settings': { 'file-size': { exclude: ['!src/routes/**'] } },
	};

	return { packWithExclude, packWithNegatedExclude };
};

describe('StandardsPackFile', () => {
	test('StandardsPackFile accepts the full pack shape and rejects an unknown key or a missing description', () => {
		const { fullPack, packWithoutDescription, packWithUnknownKey } = setupPackFiles();

		const outcomes = [fullPack, packWithUnknownKey, packWithoutDescription].map((file) => StandardsPackFile.safeParse(file));

		expect(outcomes.map(({ success, data }) => ({ success, data }))).toStrictEqual([
			{ success: true, data: fullPack },
			{ success: false, data: undefined },
			{ success: false, data: undefined },
		]);
	});

	test.each([
		{ problem: 'an empty dependencies list', appliesWhen: { dependencies: [] } },
		{ problem: 'an empty dependency name', appliesWhen: { dependencies: [''] } },
		{ problem: 'no dependencies list', appliesWhen: {} },
		{ problem: 'an unknown key', appliesWhen: { dependencies: ['react'], files: ['vite.config.ts'] } },
	])('StandardsPackFile rejects an applies-when with $problem', ({ appliesWhen }) => {
		const { fullPack } = setupPackFiles();

		const outcome = StandardsPackFile.safeParse({ ...fullPack, 'applies-when': appliesWhen });

		expect(outcome.success).toBe(false);
	});

	test('StandardsPackFile: a rule-settings entry carries an exclude list under the same rules as standards-rule-settings', () => {
		const { packWithExclude, packWithNegatedExclude } = setupExcludePacks();

		const outcomes = [packWithExclude, packWithNegatedExclude].map((file) => StandardsPackFile.safeParse(file));

		expect(outcomes.map(({ success, data }) => ({ success, data }))).toStrictEqual([
			{ success: true, data: packWithExclude },
			{ success: false, data: undefined },
		]);
	});
});
