import { describe, expect, test } from '@jest/globals';
import { StandardsPackFile } from '#src/contracts/StandardsPackFile.ts';

const setupPackFiles = () => {
	const packWithoutDescription = {
		include: {
			packs: ['lightsout/node'],
			topics: ['acme/code/architecture/services'],
			rules: ['acme/no-default-export', 'file-size'],
		},
		'rule-settings': {
			'duplicate-code-block': 'off',
			'file-size': { severity: 'advisory', options: { file: 200, tsxFile: 260 } },
		},
	};
	const fullPack = { description: 'House TypeScript style on top of the lightsout node pack.', ...packWithoutDescription };
	const packWithUnknownKey = { ...fullPack, rules: ['file-size'] };

	return { fullPack, packWithoutDescription, packWithUnknownKey };
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
});
