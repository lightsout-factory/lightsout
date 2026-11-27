import { describe, expect, test } from '@jest/globals';
import { PlanEvidence } from '@lightsout/engine/contracts';
import { render, screen, within } from '@testing-library/react';
import { PlanEvidenceDetail } from '#src/features/workOrders/components/PlanEvidenceDetail/PlanEvidenceDetail.tsx';

const problem = 'The run manifest of a1b2c3d could not be read.';

const measured = (value: number) => ({ value, provenance: 'measured' });

const reported = (value: number) => ({ value, provenance: 'reported' });

/** Parsed through the engine's own contract, so every default is filled as the reader fills it. */
const setupPlanEvidenceDetail = ({ overrides = {} }: { overrides?: Record<string, unknown> } = {}) => {
	const evidence = PlanEvidence.parse({ name: 'lo-7-search-ranking/001-ranking', headline: {}, ...overrides });
	render(<PlanEvidenceDetail evidence={evidence} />);
};

/** The section drawn under the heading of that title. */
const sectionTitled = (title: string) => {
	const section = screen.getByRole('heading', { name: title }).closest('section');

	if (section === null) {
		throw new Error(`No section holds the ${title} heading.`);
	}

	return section;
};

const reviewCases = [
	{
		tests: { state: 'finished', reviewedFiles: reported(0), rejections: reported(0) },
		expected: { noChangesNote: 1, reviewMentioned: true },
	},
	{
		tests: { state: 'finished', acceptanceTests: measured(4) },
		expected: { noChangesNote: 0, reviewMentioned: false },
	},
];

const finishedChecks = {
	state: 'finished',
	gateRuns: measured(5),
	failed: measured(2),
	fixed: measured(1),
	selfChecks: measured(3),
	repairs: [],
};

/** Every section present with the least it can hold, so each one's own heading is drawn. */
const everySection = {
	plan: { state: 'finished', gradePasses: [], findingsByStatus: [] },
	tests: { state: 'finished', acceptanceTests: measured(4) },
	checks: finishedChecks,
	cleanup: { state: 'finished', searches: [] },
	agents: { state: 'finished', processes: measured(3), peakProcesses: measured(2), byStep: [], timeline: [], judgementCalls: [] },
	ship: { state: 'finished', result: { status: 'blocked', failingChecks: [], provenance: 'measured' }, steps: [] },
};

const pullRequestUrl = 'https://github.com/acme/search/pull/7';

/** A shipped branch with its pull request, merge time and a check that failed along the way, and one step not yet reached. */
const shippedShip = {
	state: 'in-progress',
	result: { status: 'shipped', prUrl: pullRequestUrl, mergedAt: '2026-01-01T12:07:00.000Z', failingChecks: ['acme-lint'], provenance: 'measured' },
	steps: [
		{ id: 'push', status: 'passed', durationMs: 4_000, provenance: 'measured' },
		{ id: 'merge', provenance: 'measured' },
	],
};

describe('PlanEvidenceDetail', () => {
	test('states the run status first, shows the lines, marks an in-progress section, and draws no absent section', () => {
		setupPlanEvidenceDetail({
			overrides: {
				buildRunId: 'a1b2c3d4-0000-0000-0000-000000000000',
				runStatus: 'failed',
				problems: [problem],
				lines: { added: measured(6), removed: measured(3) },
				checks: {
					state: 'in-progress',
					gateRuns: measured(5),
					failed: measured(2),
					fixed: measured(1),
					selfChecks: measured(3),
					repairs: [],
				},
			},
		});

		const text = document.body.textContent ?? '';

		expect({
			statusBeforeProblem: text.search(/failed/i) > -1 && text.search(/failed/i) < text.indexOf(problem),
			problemBeforeLines: text.indexOf(problem) > -1 && text.indexOf(problem) < text.indexOf('Lines added'),
			linesAdded: screen.getByText(/Lines added/).parentElement?.textContent,
			linesRemoved: screen.getByText(/Lines removed/).parentElement?.textContent,
			checksInProgress: within(sectionTitled('Checks')).queryAllByText('In progress').length,
			shipHeadings: screen.queryAllByRole('heading', { name: 'Ship' }).length,
		}).toStrictEqual({
			statusBeforeProblem: true,
			problemBeforeLines: true,
			linesAdded: expect.stringMatching(/Lines added\D*6(?!\d)/),
			linesRemoved: expect.stringMatching(/Lines removed\D*3(?!\d)/),
			checksInProgress: 1,
			shipHeadings: 0,
		});
	});

	test.each(reviewCases)('a finished section with nothing in it says so, and an absent figure is not drawn as zero', ({ tests, expected }) => {
		setupPlanEvidenceDetail({ overrides: { tests } });

		const section = within(sectionTitled('Tests'));

		expect({
			noChangesNote: section.queryAllByText(/No test changes to review/).length,
			reviewMentioned: section.queryAllByText(/review/i).length > 0,
		}).toStrictEqual(expected);
	});

	test('draws every present section under its own title, in order', () => {
		setupPlanEvidenceDetail({ overrides: everySection });

		const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

		expect(headings).toStrictEqual(['Plan', 'Tests', 'Checks', 'Cleanup', 'Agents', 'Ship']);
	});

	test('shows the reviewed files, rejections and the test count before and after', () => {
		setupPlanEvidenceDetail({
			overrides: {
				tests: {
					state: 'finished',
					reviewedFiles: reported(3),
					rejections: reported(1),
					testCount: { before: measured(10), after: measured(14) },
				},
			},
		});

		const text = sectionTitled('Tests').textContent ?? '';

		expect({
			reviewed: /reviewed\D*3(?!\d)/i.test(text),
			rejections: /rejections\D*1(?!\d)/i.test(text),
			before: /before\D*10(?!\d)/i.test(text),
			after: /after\D*14(?!\d)/i.test(text),
			noChangesNote: /No test changes to review/.test(text),
		}).toStrictEqual({ reviewed: true, rejections: true, before: true, after: true, noChangesNote: false });
	});

	test('lists repair attempts by gate family beside the agent pre-checks', () => {
		setupPlanEvidenceDetail({ overrides: { checks: { ...finishedChecks, repairs: [{ gateFamily: 'test', attempts: measured(2) }] } } });

		const text = sectionTitled('Checks').textContent ?? '';

		expect({ repairs: /Repairs · test\D*2(?!\d)/.test(text), preChecks: /pre-checks\D*3(?!\d)/i.test(text) }).toStrictEqual({
			repairs: true,
			preChecks: true,
		});
	});

	test('shows the ship result with its pull request, merge, failing checks and each step', () => {
		setupPlanEvidenceDetail({ overrides: { ship: shippedShip } });

		const section = within(sectionTitled('Ship'));
		const steps = section.getAllByRole('listitem').map((step) => step.textContent);

		expect({
			inProgress: section.queryAllByText('In progress').length,
			status: section.queryAllByText('shipped').length,
			pullRequest: section.getByRole('link', { name: pullRequestUrl }).getAttribute('href'),
			merged: section.queryAllByText(/^Merged /).length,
			failing: section.queryAllByText(/acme-lint/).length,
			steps,
		}).toStrictEqual({
			inProgress: 1,
			status: 1,
			pullRequest: pullRequestUrl,
			merged: 1,
			failing: 1,
			steps: [expect.stringMatching(/push.*passed/), expect.stringMatching(/merge.*not reached/)],
		});
	});

	test('states a ship section that has no result yet', () => {
		setupPlanEvidenceDetail({ overrides: { ship: { state: 'in-progress', steps: [] } } });

		const text = sectionTitled('Ship').textContent ?? '';

		expect(text).toMatch(/No ship result recorded yet/);
	});
});
