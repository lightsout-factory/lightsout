import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { resolveRuleRequirements } from '#src/standardsLibraries/internal/common/utils/resolveRuleRequirements.ts';

/** A loaded rule `house/<id>` in topic `code/demo`, with its requires entries as rule.md wrote them. */
const rule = ({ id, requires }: { id: string; requires: string[] }): LoadedStandardsRule => ({
	id,
	name: `house/${id}`,
	library: 'house',
	set: 'code',
	documentPath: 'code/demo',
	summary: 'a rule',
	prose: 'the argument for the rule',
	channel: 'base',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires,
	fixturesPath: `/libraries/house/code/demo/10-${id}/fixtures`,
});

/** The rules library `house` loaded, keyed by rule id to the requires entries each declares. */
const setupRules = ({ requiresById }: { requiresById: Record<string, string[]> }) => {
	const rules = Object.entries(requiresById).map(([id, requires]) => rule({ id, requires }));

	return { rules };
};

describe('resolveRuleRequirements', () => {
	test('rewrites own-library entries to full names and reports an entry that matches no rule', () => {
		const { rules } = setupRules({ requiresById: { a: ['b'], b: [], c: ['ghost'] } });

		const resolved = resolveRuleRequirements({ library: 'house', rules });

		expect(resolved).toEqual({
			rules: expect.arrayContaining([
				expect.objectContaining({ name: 'house/a', requires: ['house/b'] }),
				expect.objectContaining({ name: 'house/b', requires: [] }),
			]),
			problems: [expect.stringMatching(/^(?=[\s\S]*code\/demo)(?=[\s\S]*ghost)/)],
		});
	});

	test('keeps entries naming another library as written', () => {
		const { rules } = setupRules({ requiresById: { a: ['house/b', 'other/x'], b: [] } });

		const resolved = resolveRuleRequirements({ library: 'house', rules });

		expect(resolved).toEqual({
			rules: expect.arrayContaining([expect.objectContaining({ name: 'house/a', requires: ['house/b', 'other/x'] })]),
			problems: [],
		});
	});
});
