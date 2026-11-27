import { describe, expect, test } from '@jest/globals';
import { PlanWorkspaceView } from '@lightsout/engine/contracts';
import { render, screen, within } from '@testing-library/react';
import { GradeHistory } from '#src/features/workOrders/components/GradeHistory.tsx';

const question = 'How do two results of the same age sort?';
const gapText = 'The plan never says how ties sort.';

const gap = { area: 'omitted-decision', gap: gapText, decision: question, phase: 'plan.md' };

const record = { id: 'f1', ...gap, firstSeen: '2026-01-01T00:00:00.000Z', lastSeen: '2026-01-01T00:00:00.000Z' };

const pass = { grade: 'below-A', passed: false, gradedAt: '2026-01-01T00:01:00.000Z' };

const cleanPass = { grade: 'A', passed: true, gradedAt: '2026-01-01T00:06:00.000Z' };

/** Parsed through the engine's own view contract, so every default is filled as the reader fills it. */
const setupGradeHistory = ({ passes = [], findings = [] }: { passes?: object[]; findings?: object[] }) => {
	const view = PlanWorkspaceView.pick({ gradePasses: true, gradeFindings: true }).parse({ gradePasses: passes, gradeFindings: findings });
	render(<GradeHistory passes={view.gradePasses} findings={view.gradeFindings} />);
};

/** Each pass as its headline and the lines of each point it raised. */
const drawnPasses = () =>
	within(screen.getByRole('list', { name: 'Grading passes' }))
		.getAllByRole('listitem')
		.filter((item) => item.parentElement?.getAttribute('aria-label') === 'Grading passes')
		.map((item) => ({
			headline: item.querySelector(':scope > p')?.textContent,
			raised: within(item)
				.queryAllByRole('listitem')
				.map((entry) => Array.from(entry.querySelectorAll('p, span > span')).map((line) => line.textContent)),
		}));

const settledCases = [
	{
		finding: {
			...record,
			status: 'resolved',
			disposition: 'needs-a-human',
			resolutions: [{ phase: 'plan.md', answerAt: 'row 4', verifiedAt: '2026-01-01T00:05:00.000Z' }],
		},
		expected: ['Needed a decision', 'Resolved in the plan — row 4'],
	},
	{ finding: { ...record, status: 'resolved', disposition: 'needs-a-human' }, expected: ['Needed a decision', 'Resolved in the plan'] },
	{
		finding: { ...record, status: 'noted', disposition: 'agent-can-decide', agentDecision: 'Sort ties by id.' },
		expected: ['Agent could decide', 'Left to the builder — Sort ties by id.'],
	},
	{
		finding: { ...record, status: 'noted', disposition: 'already-answered', answerAt: 'plan.md ## Ordering' },
		expected: ['Already answered', 'Left to the builder — plan.md ## Ordering'],
	},
	{
		finding: { ...record, status: 'open', disposition: 'needs-a-human', humanDecision: 'Pick a tie-break.' },
		expected: ['Needed a decision', 'Still open — Pick a tie-break.'],
	},
	{ finding: { ...record, status: 'pending', unjudgedReason: 'the judge failed' }, expected: ['Not ruled on yet — the judge failed'] },
	{
		finding: { ...record, status: 'superseded', disposition: 'needs-a-human', supersededBy: 'f2' },
		expected: ['Needed a decision', 'Merged into another finding — f2'],
	},
];

describe('GradeHistory', () => {
	test('shows each pass in turn with what it raised and how each point ended', () => {
		setupGradeHistory({
			passes: [{ ...pass, gaps: [{ ...gap, outcome: 'needs-a-human', findingId: 'f1' }] }, cleanPass],
			findings: [
				{
					...record,
					status: 'resolved',
					disposition: 'needs-a-human',
					resolutions: [{ phase: 'plan.md', answerAt: 'row 4', verifiedAt: '2026-01-01T00:05:00.000Z' }],
				},
			],
		});

		expect(drawnPasses()).toStrictEqual([
			{ headline: expect.stringMatching(/^Pass 1Grade below-A1 gap/), raised: [[question, gapText, 'Needed a decision', 'Resolved in the plan — row 4']] },
			{ headline: expect.stringMatching(/^Pass 2Grade ANothing found/), raised: [] },
		]);
	});

	test('counts gaps and structural findings, says when a pass did not finish, and shows a gap no record was kept of', () => {
		const structural = {
			check: 'no-placeholders',
			severity: 'blocking',
			phase: 'plan.md',
			issue: 'A TODO is left.',
			location: '## Steps',
			fix: 'Write the step.',
		};
		setupGradeHistory({
			passes: [
				{
					...pass,
					complete: false,
					incompleteReason: 'a judge failed',
					structural: [structural],
					gaps: [
						{ ...gap, outcome: 'unjudged' },
						{ ...gap, decision: 'Another?', outcome: 'agent-can-decide' },
					],
				},
				{ ...pass, gradedAt: '2026-01-01T00:02:00.000Z', complete: false, structural: [structural, { ...structural, location: '## Tests' }] },
			],
		});

		expect(drawnPasses()).toStrictEqual([
			{
				headline: expect.stringMatching(/^Pass 1Grade below-A2 gaps · 1 structural findingIncomplete — a judge failed/),
				raised: [
					[question, gapText, 'Not ruled on'],
					['Another?', gapText, 'Agent could decide'],
				],
			},
			{ headline: expect.stringMatching(/^Pass 2Grade below-A2 structural findingsIncomplete(?! —)/), raised: [] },
		]);
	});

	test.each(settledCases)('without the passes, lists each finding the grader kept and how it ended', ({ finding, expected }) => {
		setupGradeHistory({ findings: [finding] });

		const lines = screen.getAllByRole('listitem').map((entry) => Array.from(entry.querySelectorAll('p, span > span')).map((line) => line.textContent));

		expect({ lines, passes: screen.queryAllByRole('list', { name: 'Grading passes' }).length }).toStrictEqual({
			lines: [[question, gapText, ...expected]],
			passes: 0,
		});
	});

	test('says there is no grading history when the plan was never graded', () => {
		setupGradeHistory({});

		expect(document.body.textContent).toBe('No grading history yet.');
	});
});
