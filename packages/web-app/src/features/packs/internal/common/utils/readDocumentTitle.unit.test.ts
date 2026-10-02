import { describe, expect, test } from '@jest/globals';
import { readDocumentTitle } from '#src/features/packs/internal/common/utils/readDocumentTitle.ts';

describe('readDocumentTitle', () => {
	test('takes the title from the intro’s top heading', () => {
		expect(readDocumentTitle({ intro: '# Test Placement\n\nWhere unit tests sit.', path: 'tests/fractal' })).toBe('Test Placement');
	});

	test('falls back to the folder name, made readable, when the intro has no heading', () => {
		expect(readDocumentTitle({ intro: 'No heading here.', path: 'code/fractal/shared-code' })).toBe('Shared code');
	});
});
