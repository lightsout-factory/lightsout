import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack/resolveStandardsPack.ts';
import { setupStandardsLibraries } from '#tests/helpers/setupStandardsLibraries.ts';

/** Each resolved rule's full name, grade and exclude list, in the pack's own order. */
const resolveRules = ({ addresses, libraries }: { addresses: string[]; libraries: LoadedStandardsLibrary[] }) =>
	resolveStandardsPack({ addresses, libraries, dependencies: undefined }).rules.map(({ rule, severity, exclude }) => ({ name: rule.name, severity, exclude }));

/** Matches a message holding every part, in any order. */
const containsAll = (...parts: string[]) => {
	const lookaheads = parts.map((part) => {
		const literal = part.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');

		return `(?=[\\s\\S]*${literal})`;
	});

	return new RegExp(lookaheads.join(''));
};

describe('resolveStandardsPack', () => {
	test("resolveStandardsPack: a pack's rule-settings exclude reaches the resolved rule, and an unexcluded rule resolves with an empty list", () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'a', severity: StandardsSeverity.Advisory }, { id: 'b' }] }],
					packs: [{ name: 'web', rules: ['a', 'b'], ruleSettings: { a: { exclude: ['src/routes/**'] } } }],
				},
			],
		});

		const rules = resolveRules({ addresses: ['acme/web'], libraries });

		expect(rules).toStrictEqual([
			{ name: 'acme/a', severity: 'advisory', exclude: ['src/routes/**'] },
			{ name: 'acme/b', severity: 'blocking', exclude: [] },
		]);
	});

	test("resolveStandardsPack: excludes union across included packs and the pack's own rule-settings while the last severity still wins", () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'a', severity: StandardsSeverity.Off }] }],
					packs: [
						{ name: 'p1', rules: ['a'], ruleSettings: { a: { severity: 'advisory', exclude: ['x/**'] } } },
						{ name: 'p2', rules: ['a'], ruleSettings: { a: { severity: 'blocking', exclude: ['y/**'] } } },
						{ name: 'top', packs: ['acme/p1', 'acme/p2'], ruleSettings: { a: { exclude: ['x/**', 'z/**'] } } },
					],
				},
			],
		});

		const rules = resolveRules({ addresses: ['acme/top'], libraries });

		expect(rules).toStrictEqual([{ name: 'acme/a', severity: 'blocking', exclude: ['x/**', 'y/**', 'z/**'] }]);
	});

	test('resolveStandardsPack: several addresses for one package union their excludes', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [{ path: 'code/demo', rules: [{ id: 'a' }] }],
					packs: [
						{ name: 'first', rules: ['a'], ruleSettings: { a: { exclude: ['src/routes/**'] } } },
						{ name: 'second', rules: ['a'], ruleSettings: { a: { exclude: ['.storybook/**', 'src/generated/**'] } } },
					],
				},
			],
		});

		const rules = resolveRules({ addresses: ['acme/first', 'acme/second'], libraries });

		expect(rules).toStrictEqual([{ name: 'acme/a', severity: 'blocking', exclude: ['src/routes/**', '.storybook/**', 'src/generated/**'] }]);
	});

	test('resolveStandardsPack: refuses an exclude-only entry for a rule the pack does not include', () => {
		const { libraries } = setupStandardsLibraries({
			libraries: [
				{
					name: 'acme',
					topics: [
						{ path: 'code/demo', rules: [{ id: 'size' }] },
						{ path: 'code/other', rules: [{ id: 'naming' }] },
					],
					packs: [{ name: 'lean', rules: ['size'], ruleSettings: { naming: { exclude: ['src/routes/**'] } } }],
				},
			],
		});

		expect(() => resolveStandardsPack({ addresses: ['acme/lean'], libraries, dependencies: undefined })).toThrow(containsAll('acme/lean', 'naming'));
	});
});
