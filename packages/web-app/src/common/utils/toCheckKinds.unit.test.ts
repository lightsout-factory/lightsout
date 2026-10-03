import { describe, expect, test } from '@jest/globals';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { toCheckKinds } from '#src/common/utils/toCheckKinds.ts';

describe('toCheckKinds', () => {
	test.each([
		{ checked: true, reviewed: false, expected: [CheckKind.Deterministic] },
		{ checked: false, reviewed: true, expected: [CheckKind.Agent] },
		// a check that decides only part of the rule: the page shows both, never a third kind
		{ checked: true, reviewed: true, expected: [CheckKind.Deterministic, CheckKind.Agent] },
	])('a rule checked: $checked, reviewed: $reviewed has the kinds $expected', ({ checked, reviewed, expected }) => {
		const kinds = toCheckKinds({ checked, reviewed });

		expect(kinds).toStrictEqual(expected);
	});
});
