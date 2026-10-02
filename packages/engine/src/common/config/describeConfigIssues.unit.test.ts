import { describe, expect, test } from '@jest/globals';
import { describeConfigIssues } from '#src/common/config/describeConfigIssues.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

const setupRejectedConfig = () => {
	const result = LightsoutConfig.safeParse({
		gates: { check: 42, test: 'node --test', 'test-coverage': false },
		'standards-pakc': false,
	});

	if (result.success) {
		throw new Error('the fixture config must be rejected');
	}

	return { error: result.error };
};

describe('describeConfigIssues', () => {
	test('describeConfigIssues: each issue becomes one indented line keyed by its dotted path, and a root issue carries no key', () => {
		const { error } = setupRejectedConfig();

		const lines = describeConfigIssues({ error });

		expect({ count: lines.length, lines }).toEqual({
			count: 2,
			lines: expect.arrayContaining([expect.stringMatching(/^ {2}gates\.check: \S/), expect.stringMatching(/^ {2}Unrecognized key/)]),
		});
	});
});
