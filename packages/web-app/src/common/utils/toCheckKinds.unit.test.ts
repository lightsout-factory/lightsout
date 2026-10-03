import { describe, expect, test } from '@jest/globals';
import { CheckKind } from '#src/common/constants/CheckKind.ts';
import { toCheckKinds } from '#src/common/utils/toCheckKinds.ts';

describe('toCheckKinds', () => {
	test.each([
		{ deterministic: true, agent: false, expected: [CheckKind.Deterministic] },
		{ deterministic: false, agent: true, expected: [CheckKind.Agent] },
		// a check that decides only part of the rule: the page shows both, never a third kind
		{ deterministic: true, agent: true, expected: [CheckKind.Deterministic, CheckKind.Agent] },
	])('a rule deterministic: $deterministic, agent: $agent has the kinds $expected', ({ deterministic, agent, expected }) => {
		const kinds = toCheckKinds({ deterministic, agent });

		expect(kinds).toStrictEqual(expected);
	});
});
