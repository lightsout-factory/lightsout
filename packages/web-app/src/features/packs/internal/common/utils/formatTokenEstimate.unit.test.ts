import { describe, expect, test } from '@jest/globals';
import { formatTokenEstimate } from '#src/features/packs/internal/common/utils/formatTokenEstimate.ts';

describe('formatTokenEstimate', () => {
	test.each([
		{ tokens: 0, expected: '~0' },
		{ tokens: 149, expected: '~100' },
		{ tokens: 950, expected: '~1000' },
		{ tokens: 1000, expected: '~1k' },
		{ tokens: 8449, expected: '~8.4k' },
		{ tokens: 12000, expected: '~12k' },
	])('writes $tokens as $expected', ({ tokens, expected }) => {
		expect(formatTokenEstimate({ tokens })).toBe(expected);
	});
});
