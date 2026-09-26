import { describe, expect, test } from '@jest/globals';
import { toCodeLanguage } from '#src/common/utils/toCodeLanguage.ts';

describe('toCodeLanguage', () => {
	test('reads the grammar from the extension, whatever its case', () => {
		const languages = ['src/a.ts', 'src/B.TSX', 'package.json', 'README.md'].map((path) => toCodeLanguage({ path }));

		expect(languages).toStrictEqual(['typescript', 'tsx', 'json', 'markdown']);
	});

	test('names no grammar for an extension it does not know', () => {
		const language = toCodeLanguage({ path: 'notes.txt' });

		expect(language).toBeUndefined();
	});
});
