import { describe, expect, test } from '@jest/globals';
import { toLiteralPathspecs } from '#src/commit/internal/common/utils/toLiteralPathspecs.ts';

const setupPaths = () => ({ paths: ['app/[slug].tsx', "docs/it's here.md"] });

describe('toLiteralPathspecs', () => {
	test.each([
		{ exclude: false, expected: `':(literal)app/[slug].tsx' ':(literal)docs/it'\\''s here.md'` },
		{ exclude: true, expected: `':(exclude,literal)app/[slug].tsx' ':(exclude,literal)docs/it'\\''s here.md'` },
	])('builds one quoted literal pathspec per path, or an exclude spec when asked', ({ exclude, expected }) => {
		const { paths } = setupPaths();

		const pathspecs = toLiteralPathspecs({ paths, exclude });

		expect(pathspecs).toBe(expected);
	});
});
