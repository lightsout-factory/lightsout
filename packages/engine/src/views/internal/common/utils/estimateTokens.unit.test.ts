import { describe, expect, test } from '@jest/globals';
import { estimateTokens } from '#src/views/internal/common/utils/estimateTokens.ts';

describe('estimateTokens', () => {
	test.each([
		{ text: '', expected: 0 },
		{ text: 'abcd', expected: 1 },
		{ text: 'abcde', expected: 2 },
		{ text: 'a'.repeat(400), expected: 100 },
	])('estimates $expected token(s) for $text.length characters, rounding a part token up', ({ text, expected }) => {
		expect(estimateTokens({ text })).toBe(expected);
	});
});
