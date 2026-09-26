import { describe, expect, test } from '@jest/globals';
import { dropRepeatedTitle } from '#src/features/packs/screens/RuleDetail/internal/common/utils/dropRepeatedTitle.ts';

describe('dropRepeatedTitle', () => {
	test('drops an opening heading that only spells the rule id, reading an ampersand as "and"', () => {
		const prose = dropRepeatedTitle({ prose: '## Modules & the Graduation Rule\n\nA module is a unit.', ruleId: 'modules-and-the-graduation-rule' });

		expect(prose).toBe('A module is a unit.');
	});

	test('keeps an opening heading that says something the id does not', () => {
		const prose = dropRepeatedTitle({ prose: '## Syntax & Style\n\nUse object args.', ruleId: 'object-args' });

		expect(prose).toBe('## Syntax & Style\n\nUse object args.');
	});

	test('keeps prose that opens without a heading', () => {
		const prose = dropRepeatedTitle({ prose: 'Avoid `as` casts.', ruleId: 'type-assertion' });

		expect(prose).toBe('Avoid `as` casts.');
	});
});
