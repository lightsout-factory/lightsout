import { describe, expect, test } from '@jest/globals';
import { describeCheckKinds } from '#src/cli/standards/common/describeCheckKinds.ts';

describe('describeCheckKinds', () => {
	test.each([
		{ rule: { deterministic: true, agent: false }, expected: 'deterministic' },
		{ rule: { deterministic: false, agent: true }, expected: 'agent' },
		// both kinds: the table must not read as though the deterministic check decided all of it
		{ rule: { deterministic: true, agent: true }, expected: 'deterministic and agent' },
	])('names the checks of a rule that is deterministic: $rule.deterministic, agent: $rule.agent', ({ rule, expected }) => {
		const cell = describeCheckKinds({ rule });

		expect(cell).toBe(expected);
	});
});
