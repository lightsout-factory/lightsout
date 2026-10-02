import { describe, expect, test } from '@jest/globals';
import { describeCheckedBy } from '#src/cli/internal/common/render/common/utils/describeCheckedBy.ts';

describe('describeCheckedBy', () => {
	test.each([
		{ rule: { checked: true, reviewed: false }, expected: 'code' },
		{ rule: { checked: false, reviewed: true }, expected: 'judgment' },
		// a check that covers part of the rule: the table must not read as though code enforced all of it
		{ rule: { checked: true, reviewed: true }, expected: 'code and judgment' },
	])('names what enforces a rule that is checked: $rule.checked, reviewed: $rule.reviewed', ({ rule, expected }) => {
		const cell = describeCheckedBy({ rule });

		expect(cell).toBe(expected);
	});
});
