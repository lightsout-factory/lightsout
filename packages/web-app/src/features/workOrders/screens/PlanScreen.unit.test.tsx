import { describe, expect, test } from '@jest/globals';
import { EvidenceProvenance, PlanEvidence, PlanWorkspaceView, RunStatus } from '@lightsout/engine';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { fireEvent, screen, within } from '@testing-library/react';
import { planEvidenceQueryOptions } from '#src/features/workOrders/queries/planEvidenceQueryOptions.ts';
import { planWorkspaceQueryOptions } from '#src/features/workOrders/queries/planWorkspaceQueryOptions.ts';
import { PlanScreen } from '#src/features/workOrders/screens/PlanScreen.tsx';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

const workOrder = 'lo-7-search-ranking';
const plan = '001-ranking';

const planText = 'Rank results by recency, newest first.';
const notesText = 'Recency beats relevance for this audience.';
const brainstormQuestion = 'Which order do results come in?';
const decisionQuestion = 'Does an older pinned result stay on top?';

/** A run of this plan that ended failed, so its row has a status to show and nothing to link to. */
const failedRun = {
	runId: 'a1b2c3d4-0000-0000-0000-000000000000',
	shortId: 'a1b2c3d4',
	pipeline: 'implement',
	status: RunStatus.Failed,
	title: 'Rank by recency',
	plan: '.lightsout/work-orders/lo-7-search-ranking/plans/001-ranking/plan.md',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:05:00.000Z',
	live: false,
	packages: [],
	stepsPassed: 1,
	stepCount: 3,
	changedFileCount: 2,
	resumable: true,
};

/** A passed grade, as `grade.json` records it. */
const passedGrade = {
	planName: plan,
	grade: 'A',
	scopeComplete: true,
	passed: true,
	gradedAt: '2026-01-01T00:04:00.000Z',
	scope: 'full',
	covered: ['plan.md'],
};

/** One row per planning step, as the engine's shared step-row rule hands them over. */
const planningSteps = [
	{ id: 'verify-facts', status: RunStatus.Passed, attempts: 1, durationMs: 4_000 },
	{ id: 'draft', status: RunStatus.Passed, attempts: 2, durationMs: 65_000 },
	{ id: 'dedup', status: RunStatus.Failed, attempts: 3 },
	{ id: 'grade', attempts: 0 },
	{ id: 'publish', attempts: 0 },
];

/** Parsed through the engine's own contract, so every default the view carries is filled exactly as the reader fills it. */
const buildWorkspace = (overrides: Record<string, unknown> = {}): PlanWorkspaceView =>
	PlanWorkspaceView.parse({
		listing: {
			name: `${workOrder}/${plan}`,
			stage: 'drafted',
			hasNotes: false,
			hasPlanFile: true,
			implementedFiles: [],
			phased: false,
			phaseCount: 0,
			updatedAt: '2026-01-01T00:05:00.000Z',
			runCount: 0,
		},
		rootPath: `/repos/app/.lightsout/work-orders/${workOrder}/plans/${plan}`,
		...overrides,
	});

/** The page under a memory-history router whose one route renders it, its workspace seeded as the route's loader would. */
const setupPlanScreen = async ({ workspace = buildWorkspace() }: { workspace?: PlanWorkspaceView } = {}) => {
	const rootRoute = createRootRoute({ component: () => <PlanScreen workOrder={workOrder} plan={plan} /> });
	const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) });
	await router.load();
	renderWithQueryClient({
		ui: <RouterProvider router={router} />,
		seed: [{ queryKey: planWorkspaceQueryOptions({ workOrder, plan }).queryKey, data: workspace }],
	});
	await screen.findByRole('tablist');
};

// A tab strip selects on the press, not on the release. A bare `click` fires
// no mouse-down, so the strip would stay exactly where it was.
const chooseTab = ({ name }: { name: string }) => {
	fireEvent.mouseDown(screen.getByRole('tab', { name }));
};

/** The text of every innermost element under `root`, so a row reads as its cells whatever element draws it. */
const leafTexts = ({ root }: { root: Element }) =>
	Array.from(root.querySelectorAll('*'))
		.filter((element) => element.children.length === 0)
		.map((element) => element.textContent?.trim() ?? '')
		.filter((text) => text !== '');

/** The cells of the row holding `text` in the open panel. */
const rowCells = ({ panel, text }: { panel: HTMLElement; text: string }) => {
	const cell = within(panel).getByText(text);
	const row = cell.closest('tr, li') ?? cell.parentElement ?? cell;

	return leafTexts({ root: row });
};

/** Elements sorted into the order a reader meets them on the page. */
const inDocumentOrder = ({ elements }: { elements: Element[] }) =>
	[...elements].sort((first, second) => (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

const planTabCases = [
	{
		workspace: buildWorkspace({
			planText,
			phases: [
				{ name: 'phase1-schema.md', text: 'Add the recency column.', implemented: true },
				{ name: 'phase2-ranking.md', text: 'Sort by the new column.', implemented: false },
			],
		}),
		expected: {
			order: [planText, expect.stringContaining('phase1-schema'), expect.stringContaining('phase2-ranking')],
			sections: [
				{ title: expect.stringContaining('phase1-schema'), implemented: true, text: expect.stringContaining('Add the recency column.') },
				{ title: expect.stringContaining('phase2-ranking'), implemented: false, text: expect.stringContaining('Sort by the new column.') },
			],
		},
	},
	{
		workspace: buildWorkspace(),
		expected: { order: [expect.stringMatching(/no plan drafted yet/i)], sections: [] },
	},
];

const recordedDecisions = {
	brainstormDecisions: {
		planName: plan,
		decisions: [{ source: 'Brainstorm', question: brainstormQuestion, options: 'newest / best match', choice: 'newest', rationale: 'readers want news' }],
	},
	decisions: {
		planName: plan,
		decisions: [{ source: 'Elicitation', question: decisionQuestion, options: 'yes / no', choice: 'yes', rationale: 'pins are editorial', assumption: true }],
	},
};

/** Every text either tab could show, so each case states which of them its open panel holds. */
const decisionTabTexts = [notesText, brainstormQuestion, decisionQuestion, /no decisions recorded yet/i];

const decisionTabCases = [
	{ tab: 'Brainstorm', workspace: buildWorkspace({ notesText, ...recordedDecisions }), expected: { shown: [notesText, brainstormQuestion], tables: 1 } },
	{ tab: 'Decisions', workspace: buildWorkspace({ notesText, ...recordedDecisions }), expected: { shown: [decisionQuestion], tables: 1 } },
	{
		tab: 'Decisions',
		workspace: buildWorkspace({ notesText, brainstormDecisions: recordedDecisions.brainstormDecisions }),
		expected: { shown: [/no decisions recorded yet/i], tables: 0 },
	},
];

const statusTabCases = [
	{ grade: passedGrade, gradeText: /\bA\b/ },
	{ grade: undefined, gradeText: /not graded/i },
];

/** A plan merged two hours and seven minutes after planning began, with its recorded cost and the questions put to the user. */
const buildEvidence = (): PlanEvidence =>
	PlanEvidence.parse({
		name: `${workOrder}/${plan}`,
		headline: {
			startedAt: '2026-01-01T10:00:00.000Z',
			mergedAt: '2026-01-01T12:07:00.000Z',
			questionsAsked: { value: 2, provenance: EvidenceProvenance.Measured },
			recordedCostUsd: { value: 5.5, provenance: EvidenceProvenance.Measured },
		},
	});

/** The page with both its workspace and its evidence seeded, so whichever tab opens reads from the cache and no server function runs. */
const setupPlanScreenWithEvidence = async ({ workspace, evidence }: { workspace: PlanWorkspaceView; evidence: PlanEvidence }) => {
	const rootRoute = createRootRoute({ component: () => <PlanScreen workOrder={workOrder} plan={plan} /> });
	const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) });
	await router.load();
	renderWithQueryClient({
		ui: <RouterProvider router={router} />,
		seed: [
			{ queryKey: planWorkspaceQueryOptions({ workOrder, plan }).queryKey, data: workspace },
			{ queryKey: planEvidenceQueryOptions({ workOrder, plan }).queryKey, data: evidence },
		],
	});
	await screen.findByRole('tablist');
};

/** Every text the Evidence or the Status tab could show, so each case states which of them its open panel holds. */
const evidenceTabTexts = [/plan to merge/i, /recorded cost/i, /\$5\.50/, /questions asked of you/i, 'Grading history', 'Rank by recency'];

const evidenceTabCases = [
	{ tab: 'Evidence', expected: [/plan to merge/i, /recorded cost/i, /\$5\.50/, /questions asked of you/i] },
	{ tab: 'Status', expected: ['Grading history', 'Rank by recency'] },
];

describe('PlanScreen', () => {
	test.each(planTabCases)('opens on the Plan tab with the plan text then each phase as its own section', async ({ workspace, expected }) => {
		await setupPlanScreen({ workspace });

		const openTab = screen.getByRole('tab', { selected: true });
		const panel = screen.getByRole('tabpanel');
		const lead = within(panel).queryAllByText(/Rank results by recency, newest first\.|no plan drafted yet/i);
		const sections = Array.from(panel.querySelectorAll('section')).filter((section) => /phase/.test(section.querySelector('h2')?.textContent ?? ''));
		const headings = sections.map((section) => section.querySelector('h2')).filter((heading) => heading !== null);
		const order = inDocumentOrder({ elements: [...lead.slice(0, 1), ...headings] });

		expect({
			openTab: openTab.textContent,
			order: order.map((element) => element.textContent),
			sections: sections.map((section) => ({
				title: section.querySelector('h2')?.textContent,
				implemented: within(section).queryAllByText(/^implemented$/i).length > 0,
				text: section.textContent,
			})),
		}).toStrictEqual({ openTab: 'Plan', ...expected });
	});

	test.each(decisionTabCases)('the Brainstorm and Decisions tabs show the notes and both decision records', async ({ tab, workspace, expected }) => {
		await setupPlanScreen({ workspace });

		chooseTab({ name: tab });
		const panel = screen.getByRole('tabpanel');

		expect({
			shown: decisionTabTexts.filter((text) => within(panel).queryAllByText(text).length > 0),
			tables: within(panel).queryAllByRole('table').length,
		}).toStrictEqual(expected);
	});

	test.each(statusTabCases)("the Status tab shows planning rows, the grade and each run's status with no link", async ({ grade, gradeText }) => {
		await setupPlanScreen({ workspace: buildWorkspace({ planningSteps, runs: [failedRun], grade }) });

		chooseTab({ name: 'Status' });
		const panel = screen.getByRole('tabpanel');

		expect({
			verifyFacts: rowCells({ panel, text: 'verify-facts' }),
			draft: rowCells({ panel, text: 'draft' }),
			dedup: rowCells({ panel, text: 'dedup' }),
			publish: rowCells({ panel, text: 'publish' }),
			run: rowCells({ panel, text: 'Rank by recency' }),
			panel: leafTexts({ root: panel }),
			links: within(panel).queryAllByRole('link'),
		}).toStrictEqual({
			verifyFacts: expect.arrayContaining(['verify-facts', expect.stringMatching(/^passed$/i), '4s']),
			draft: expect.arrayContaining(['draft', expect.stringMatching(/^passed$/i), expect.stringMatching(/\b2\b/), '1m 05s']),
			dedup: expect.arrayContaining(['dedup', expect.stringMatching(/^failed$/i), expect.stringMatching(/\b3\b/), '—']),
			publish: expect.arrayContaining(['publish', expect.stringMatching(/^not run$/i), '—']),
			run: expect.arrayContaining(['a1b2c3d4', 'Rank by recency', expect.stringMatching(/^failed$/i)]),
			panel: expect.arrayContaining([expect.stringMatching(gradeText)]),
			links: [],
		});
	});

	test('the Status tab shows the grade and the duplicate check each under its own heading', async () => {
		const dedup = { planName: plan, reviewed: [], reviewedAt: '2026-01-01T00:03:00.000Z' };
		await setupPlanScreen({ workspace: buildWorkspace({ planningSteps, grade: passedGrade, dedup }) });

		chooseTab({ name: 'Status' });
		const panel = screen.getByRole('tabpanel');
		const sectionText = ({ title }: { title: string }) => within(panel).getByRole('heading', { name: title }).closest('section')?.textContent;

		expect({ grade: sectionText({ title: 'Grade' }), dedup: sectionText({ title: 'Duplicate check' }) }).toStrictEqual({
			grade: expect.stringMatching(/Grade A.*Passed.*No findings\./),
			dedup: expect.stringMatching(/No duplicates found/),
		});
	});

	test('the Status tab shows each grading pass under its own heading', async () => {
		const gradePasses = [
			{ grade: 'below-A', passed: false, gradedAt: '2026-01-01T00:01:00.000Z' },
			{ grade: 'A', passed: true, gradedAt: '2026-01-01T00:04:00.000Z' },
		];
		await setupPlanScreen({ workspace: buildWorkspace({ planningSteps, grade: passedGrade, gradePasses }) });

		chooseTab({ name: 'Status' });
		const section = within(screen.getByRole('tabpanel')).getByRole('heading', { name: 'Grading history' }).closest('section');

		expect(section?.textContent).toStrictEqual(expect.stringMatching(/Pass 1Grade below-A.*Pass 2Grade A/));
	});

	test('the Facts tab shows what the planner confirmed, or says nothing is recorded', async () => {
		const facts = { request: 'Rank results by recency.', verification: { pathsChecked: 3, scriptsChecked: 1 }, verifiedAt: '2026-01-01T00:01:00.000Z' };
		await setupPlanScreen({ workspace: buildWorkspace({ facts }) });

		chooseTab({ name: 'Facts' });
		const panel = screen.getByRole('tabpanel');

		expect({
			request: within(panel).queryAllByText('Rank results by recency.').length,
			empty: within(panel).queryAllByText(/no facts recorded yet/i).length,
		}).toStrictEqual({ request: 1, empty: 0 });
	});

	test('the Brainstorm tab says there are no notes and draws no table when brainstorming wrote nothing', async () => {
		await setupPlanScreen({ workspace: buildWorkspace() });

		chooseTab({ name: 'Brainstorm' });
		const panel = screen.getByRole('tabpanel');

		expect({ note: within(panel).queryAllByText(/no brainstorm notes/i).length, tables: within(panel).queryAllByRole('table').length }).toStrictEqual({
			note: 1,
			tables: 0,
		});
	});

	test('the Status tab says there are no runs yet when the plan has none', async () => {
		await setupPlanScreen({ workspace: buildWorkspace({ planningSteps }) });

		chooseTab({ name: 'Status' });
		const panel = screen.getByRole('tabpanel');

		expect(within(panel).queryAllByText(/no runs yet/i)).toHaveLength(1);
	});

	test('the Status tab tags a run whose process is live', async () => {
		await setupPlanScreen({ workspace: buildWorkspace({ planningSteps, runs: [{ ...failedRun, status: RunStatus.Running, live: true }] }) });

		chooseTab({ name: 'Status' });
		const panel = screen.getByRole('tabpanel');

		expect(rowCells({ panel, text: 'Rank by recency' })).toStrictEqual(
			expect.arrayContaining(['a1b2c3d4', 'Rank by recency', expect.stringMatching(/^running$/i), expect.stringMatching(/^live$/i)]),
		);
	});

	test('lists every problem the workspace reported', async () => {
		await setupPlanScreen({ workspace: buildWorkspace({ problems: ['grade.json could not be parsed', 'phase2-ranking.md could not be read'] }) });

		const tablist = screen.getByRole('tablist');
		const problems = [screen.getByText('grade.json could not be parsed'), screen.getByText('phase2-ranking.md could not be read')];

		expect(problems.map((problem) => Boolean(problem.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING))).toStrictEqual([true, true]);
	});

	test.each(evidenceTabCases)('the Evidence tab shows the evidence summary and the Status tab keeps its detail', async ({ tab, expected }) => {
		const gradePasses = [{ grade: 'A', passed: true, gradedAt: '2026-01-01T00:04:00.000Z' }];
		await setupPlanScreenWithEvidence({
			workspace: buildWorkspace({ planningSteps, runs: [failedRun], grade: passedGrade, gradePasses }),
			evidence: buildEvidence(),
		});

		chooseTab({ name: tab });
		const panel = screen.getByRole('tabpanel');

		expect(evidenceTabTexts.filter((text) => within(panel).queryAllByText(text).length > 0)).toStrictEqual(expected);
	});
});
