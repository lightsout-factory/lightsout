import { describe, expect, jest, test } from '@jest/globals';
import { type PlanEvidence, PlanWorkspaceView } from '@lightsout/engine';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { fireEvent, screen } from '@testing-library/react';
import { planWorkspaceQueryOptions } from '#src/features/workOrders/queries/planWorkspaceQueryOptions.ts';
import { PlanScreen } from '#src/features/workOrders/screens/PlanScreen.tsx';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// The server function is the boundary the Evidence tab's query reaches when
// its key is not seeded: holding it open or refusing it is how the tab's
// loading and unreadable states are reached.
const mockGetPlanEvidence = jest.fn<(params: { data: { name: string } }) => Promise<PlanEvidence>>();

jest.mock('#src/features/workOrders/server/getPlanEvidenceServerFn.ts', () => ({
	getPlanEvidenceServerFn: (params: { data: { name: string } }) => mockGetPlanEvidence(params),
}));
// -------------------------

const workOrder = 'lo-7-search-ranking';
const plan = '001-ranking';

/** The page with only its workspace seeded, so opening the Evidence tab asks the server function for the summary. */
const setupPlanScreenEvidenceTab = async ({ answer }: { answer: () => Promise<PlanEvidence> }) => {
	mockGetPlanEvidence.mockImplementation(answer);
	const workspace = PlanWorkspaceView.parse({
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
	});
	const rootRoute = createRootRoute({ component: () => <PlanScreen workOrder={workOrder} plan={plan} /> });
	const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) });
	await router.load();
	renderWithQueryClient({
		ui: <RouterProvider router={router} />,
		seed: [{ queryKey: planWorkspaceQueryOptions({ workOrder, plan }).queryKey, data: workspace }],
	});
	await screen.findByRole('tablist');
};

describe('PlanScreen', () => {
	test('says the evidence is loading while the summary has not arrived', async () => {
		await setupPlanScreenEvidenceTab({ answer: () => new Promise<PlanEvidence>(() => undefined) });

		fireEvent.mouseDown(screen.getByRole('tab', { name: 'Evidence' }));
		const panel = screen.getByRole('tabpanel');

		expect(panel.textContent).toMatch(/loading evidence/i);
	});

	test('says the evidence could not be read when the summary is refused', async () => {
		await setupPlanScreenEvidenceTab({ answer: () => Promise.reject(new Error('activity.jsonl could not be read')) });

		fireEvent.mouseDown(screen.getByRole('tab', { name: 'Evidence' }));
		const message = await screen.findByText(/evidence could not be read/i);

		expect(message).toBeInTheDocument();
	});
});
