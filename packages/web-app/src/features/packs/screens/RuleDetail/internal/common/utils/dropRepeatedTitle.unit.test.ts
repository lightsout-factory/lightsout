import { describe, expect, test } from '@jest/globals';
import { dropRepeatedTitle } from '#src/features/packs/screens/RuleDetail/internal/common/utils/dropRepeatedTitle.ts';

describe('dropRepeatedTitle', () => {
	test('drops an opening heading that only spells the rule id, reading an ampersand as "and"', () => {
		const prose = dropRepeatedTitle({ prose: '## Props & State\n\nKeep state local.', ruleId: 'props-and-state' });

		expect(prose).toBe('Keep state local.');
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
