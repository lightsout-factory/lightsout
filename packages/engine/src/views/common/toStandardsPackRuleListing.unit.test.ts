import { describe, expect, test } from '@jest/globals';
import { StandardsSet } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { toStandardsPackRuleListing } from '#src/views/common/toStandardsPackRuleListing.ts';

/** A rule as the fold hands it over, carrying the given default options. */
const setupRule = ({ defaultOptions }: { defaultOptions: Record<string, number> }) => {
	const rule = {
		id: 'file-size',
		name: 'lightsout/file-size',
		set: StandardsSet.Code,
		documentPath: 'code/fractal/size',
		summary: 'Keep each file under its line cap.',
		deterministic: true,
		agent: false,
		defaultSeverity: StandardsSeverity.Blocking,
		defaultOptions,
	};
	const fixtureCounts = { pass: 2, fail: 3 };

	return { rule, fixtureCounts };
};

/** A rule with default options, and one without: both must come through as the rule declares them. */
const defaultOptionCases: { defaultOptions: Record<string, number>; expected: Record<string, number> }[] = [
	{ defaultOptions: { file: 250, tsxFile: 300 }, expected: { file: 250, tsxFile: 300 } },
	{ defaultOptions: {}, expected: {} },
];

describe('toStandardsPackRuleListing', () => {
	test.each(defaultOptionCases)("copies the rule's default options unchanged", ({ defaultOptions, expected }) => {
		const { rule, fixtureCounts } = setupRule({ defaultOptions });

		const listing = toStandardsPackRuleListing({ rule, fixtureCounts });

		expect({ defaultOptions: listing.defaultOptions, fixtureCounts: listing.fixtureCounts }).toStrictEqual({
			defaultOptions: expected,
			fixtureCounts: { pass: 2, fail: 3 },
		});
	});
});
