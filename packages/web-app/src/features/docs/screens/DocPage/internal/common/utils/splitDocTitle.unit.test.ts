import { describe, expect, test } from '@jest/globals';
import { splitDocTitle } from '#src/features/docs/screens/DocPage/internal/common/utils/splitDocTitle.ts';

describe('splitDocTitle', () => {
	test('lifts the opening `# Title` out of the body', () => {
		expect(splitDocTitle({ text: '# Monorepos\n\nBody text.\n' })).toStrictEqual({ title: 'Monorepos', body: 'Body text.\n' });
	});

	test('leaves a doc with no opening title whole', () => {
		expect(splitDocTitle({ text: 'Body text.\n\n## Section\n' })).toStrictEqual({ title: undefined, body: 'Body text.\n\n## Section\n' });
	});

	test('takes only a first-level heading as the title', () => {
		expect(splitDocTitle({ text: '## Section\n' })).toStrictEqual({ title: undefined, body: '## Section\n' });
	});
});
