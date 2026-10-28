import { describe, expect, test } from '@jest/globals';
import { resolveDocHref } from '#src/features/docs/screens/DocPage/internal/common/utils/resolveDocHref.ts';

describe('resolveDocHref', () => {
	test.each([
		{ href: 'monorepos.md', expected: '/docs/monorepos' },
		{ href: './monorepos.md', expected: '/docs/monorepos' },
		{ href: 'monorepos.md#how-package-gates-work', expected: '/docs/monorepos#how-package-gates-work' },
	])('points $href, a doc the site carries, at its page', ({ href, expected }) => {
		expect(resolveDocHref(href)).toBe(expected);
	});

	test.each(['unknown.md', 'https://example.com', '#minimal-setup', '../README.md'])('leaves %s as written', (href) => {
		expect(resolveDocHref(href)).toBeUndefined();
	});
});
