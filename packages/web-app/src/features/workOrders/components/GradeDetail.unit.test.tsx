import { describe, expect, test } from '@jest/globals';
import { GradeReport } from '@lightsout/engine/contracts';
import { render, screen, within } from '@testing-library/react';
import { GradeDetail } from '#src/features/workOrders/components/GradeDetail.tsx';

/** Parsed through the engine's own contract, so every default is filled as the reader fills it. */
const buildGrade = (overrides: Record<string, unknown> = {}) =>
	GradeReport.parse({
		planName: 'lo-7-search-ranking/001-ranking',
		grade: 'A',
		scopeComplete: true,
		passed: true,
		gradedAt: '2026-01-01T00:04:00.000Z',
		scope: 'full',
		covered: ['plan.md'],
		...overrides,
	});

const structuralFinding = {
	check: 'scope-within-guardrail',
	severity: 'blocking',
	phase: 'plan.md',
	issue: 'The plan creates 31 files.',
	location: '## Files to Create',
	fix: 'Drop one created file.',
};

const gap = { area: 'omitted-decision', gap: 'The plan never says how ties sort.', decision: 'How do two results of the same age sort?', phase: 'plan.md' };

const setupGradeDetail = ({ grade }: { grade: GradeReport | undefined }) => {
	render(<GradeDetail grade={grade} />);
};

/** Each list item as the lines a reader sees in it. */
const itemLines = ({ name }: { name: string }) =>
	within(screen.getByRole('list', { name }))
		.getAllByRole('listitem')
		.map((item) => Array.from(item.querySelectorAll('p')).map((line) => line.textContent));

const verdictCases = [
	{ grade: undefined, expected: ['Not graded'] },
	{ grade: buildGrade(), expected: [expect.stringMatching(/^Grade A.*Passed/), 'No findings.'] },
	{
		grade: buildGrade({ grade: 'below-A', passed: false, gaps: [{ ...gap, outcome: 'unjudged' }] }),
		expected: [expect.stringMatching(/^Grade below-A.*Did not pass/)],
	},
	{
		grade: buildGrade({ grade: 'below-A', passed: false, complete: false, incompleteReason: 'a judge hit the rate limit' }),
		expected: [expect.stringMatching(/^Grade below-A.*Incomplete — a judge hit the rate limit/), 'No findings.'],
	},
	{ grade: buildGrade({ grade: 'below-A', passed: false, complete: false }), expected: [expect.stringMatching(/^Grade below-A.*Incomplete/), 'No findings.'] },
];

const gapCases = [
	{ verdict: { outcome: 'needs-a-human', humanDecision: 'Pick a tie-break.' }, resolution: ['Pick a tie-break.'] },
	{
		verdict: { outcome: 'agent-can-decide', agentDecision: 'Sort ties by id.', safeBecause: 'ids are stable' },
		resolution: ['Sort ties by id. — ids are stable'],
	},
	{ verdict: { outcome: 'agent-can-decide', agentDecision: 'Sort ties by id.' }, resolution: ['Sort ties by id.'] },
	{ verdict: { outcome: 'already-answered', answerAt: 'plan.md ## Ordering' }, resolution: ['plan.md ## Ordering'] },
	{ verdict: { outcome: 'unjudged', unjudgedReason: 'the judge failed' }, resolution: ['the judge failed'] },
	{ verdict: { outcome: 'unjudged' }, resolution: [] },
];

describe('GradeDetail', () => {
	test.each(verdictCases)('states the verdict, and says so when nothing was found', ({ grade, expected }) => {
		setupGradeDetail({ grade });

		const lines = Array.from(document.body.querySelectorAll('div > p')).map((line) => line.textContent);

		expect(lines).toStrictEqual(expected);
	});

	test('lists each structural finding with its issue and its fix', () => {
		setupGradeDetail({ grade: buildGrade({ grade: 'below-A', passed: false, structural: [structuralFinding] }) });

		expect(itemLines({ name: 'Structural findings' })).toStrictEqual([
			[expect.stringMatching(/blocking.*scope-within-guardrail.*plan\.md.*## Files to Create/), 'The plan creates 31 files.', 'Drop one created file.'],
		]);
	});

	test.each(gapCases)('lists each gap with the line its outcome carries', ({ verdict, resolution }) => {
		setupGradeDetail({ grade: buildGrade({ grade: 'below-A', passed: false, gaps: [{ ...gap, ...verdict }] }) });

		expect(itemLines({ name: 'Gaps' })).toStrictEqual([
			[
				expect.stringMatching(new RegExp(`${verdict.outcome}.*omitted-decision.*plan\\.md`)),
				'How do two results of the same age sort?',
				'The plan never says how ties sort.',
				...resolution,
			],
		]);
	});
});
