import { describe, expect, test } from '@jest/globals';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { toCheckKind } from '#src/common/utils/toCheckKind.ts';

describe('toCheckKind', () => {
	test.each([
		{ checked: true, reviewed: false, expected: CheckKind.Deterministic },
		{ checked: false, reviewed: true, expected: CheckKind.Agent },
		// a check that decides only part of the rule: the page must not read as though code decided all of it
		{ checked: true, reviewed: true, expected: CheckKind.Both },
	])('a rule checked: $checked, reviewed: $reviewed shows as $expected', ({ checked, reviewed, expected }) => {
		const kind = toCheckKind({ checked, reviewed });

		expect(kind).toBe(expected);
	});
});
