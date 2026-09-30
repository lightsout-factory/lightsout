import { describe, expect, test } from '@jest/globals';
import { StandardsPackRuleListing } from '#src/contracts/views/StandardsPackRuleListing.ts';

const setupListings = () => {
	const baseListing = {
		id: 'file-size',
		set: 'code',
		documentPath: 'code/style-guide/patterns/functions',
		summary: 'A source file stays under its line cap.',
		channel: 'base',
		checked: true,
		defaultSeverity: 'blocking',
		fixtureCounts: { pass: 1, fail: 1 },
	};
	const withOptions = { ...baseListing, defaultOptions: { file: 250, tsxFile: 300 } };
	const withSettingsOnly = { ...baseListing, defaultSettings: { file: 250, tsxFile: 300 } };

	return { withOptions, withSettingsOnly };
};

describe('StandardsPackRuleListing', () => {
	test('StandardsPackRuleListing: a listing needs defaultOptions, and defaultSettings does not stand in for them', () => {
		const { withOptions, withSettingsOnly } = setupListings();

		const parsed = StandardsPackRuleListing.parse(withOptions);
		const refused = StandardsPackRuleListing.safeParse(withSettingsOnly);

		expect({ parsed, refusedSuccess: refused.success }).toStrictEqual({
			parsed: {
				id: 'file-size',
				set: 'code',
				documentPath: 'code/style-guide/patterns/functions',
				summary: 'A source file stays under its line cap.',
				channel: 'base',
				checked: true,
				defaultSeverity: 'blocking',
				defaultOptions: { file: 250, tsxFile: 300 },
				fixtureCounts: { pass: 1, fail: 1 },
			},
			refusedSuccess: false,
		});
	});
});
