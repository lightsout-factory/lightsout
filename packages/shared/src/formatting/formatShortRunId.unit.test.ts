import { expect, test } from '@jest/globals';
import { formatShortRunId } from '#src/formatting/formatShortRunId.ts';

test('formatShortRunId: keeps the first eight characters, and a shorter id whole', () => {
	expect(formatShortRunId({ runId: '0f3c9a12-5b7e-4d21-9c0a-6e8f2b1d4a37' })).toBe('0f3c9a12');
	expect(formatShortRunId({ runId: 'run-42' })).toBe('run-42');
});
