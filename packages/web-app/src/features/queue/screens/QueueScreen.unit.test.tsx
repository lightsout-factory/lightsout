import { describe, expect, test } from '@jest/globals';
import { QueueBoardState, type QueueView } from '@lightsout/engine';
import { type QueueBoardTicket, QueueLane } from '@lightsout/engine/contracts';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import { queueViewQueryOptions } from '#src/features/queue/queries/queueViewQueryOptions.ts';
import { QueueScreen } from '#src/features/queue/screens/QueueScreen.tsx';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

type Drain = NonNullable<QueueView['drain']>;

// Built from local wall-clock parts, so the drain's time reads the same local
// time whatever time zone the suite runs in.
const drainAt = new Date(2026, 10, 26, 10, 0).toISOString();

const buildTicket = (overrides: Partial<QueueBoardTicket> = {}): QueueBoardTicket => ({
	identifier: 'LO-1',
	title: 'Rebuild the app',
	lane: QueueLane.Parked,
	enteredAt: drainAt,
	...overrides,
});

const buildDrain = (overrides: Partial<Drain> = {}): Drain => ({
	runId: 'queue-run-1',
	state: QueueBoardState.Live,
	at: drainAt,
	lanes: [],
	...overrides,
});

/**
 * The page under a memory-history router whose one route renders it, with the
 * queue view its loader would have fetched already in the cache.
 */
const setupQueueScreen = async ({ view = { drain: buildDrain() } }: { view?: QueueView } = {}) => {
	const rootRoute = createRootRoute();
	const queueRoute = createRoute({ getParentRoute: () => rootRoute, path: '/app/queue', component: QueueScreen });
	const router = createRouter({
		routeTree: rootRoute.addChildren([queueRoute]),
		history: createMemoryHistory({ initialEntries: ['/app/queue'] }),
	});
	renderWithQueryClient({
		ui: <RouterProvider router={router} />,
		seed: [{ queryKey: queueViewQueryOptions().queryKey, data: view }],
	});
	await screen.findByRole('heading', { level: 1, name: 'Queue' });
};

const readLaneTitles = (): string[] => screen.queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent ?? '');

const readHrefs = (): (string | null)[] => screen.queryAllByRole('link').map((link) => link.getAttribute('href'));

describe('QueueScreen', () => {
	test('says the queue has not run when no drain is on disk', async () => {
		await setupQueueScreen({ view: { drain: undefined } });

		const message = screen.getByText(/The queue has not run/);

		expect({ shown: message.textContent, lanes: readLaneTitles() }).toStrictEqual({ shown: expect.stringContaining('has not run'), lanes: [] });
	});

	test.each([
		{ state: QueueBoardState.Live, line: /Queue live\s*·\s*updated\s*26 Nov 2026, 10:00/ },
		{ state: QueueBoardState.Stopped, line: /Queue stopped\s*·\s*last update\s*26 Nov 2026, 10:00/ },
		{ state: QueueBoardState.Finished, line: /Queue finished\s*·\s*26 Nov 2026, 10:00/ },
	])('heads the drain with its state and time', async ({ state, line }) => {
		await setupQueueScreen({ view: { drain: buildDrain({ state }) } });

		const pageText = document.body.textContent;

		expect(pageText).toMatch(line);
	});

	test('draws one section per lane holding tickets, with reasons, questions and work-order links', async () => {
		await setupQueueScreen({
			view: {
				drain: buildDrain({
					lanes: [
						{ lane: QueueLane.Parked, tickets: [buildTicket({ identifier: 'LO-1', reason: 'Waiting on a design call' })] },
						{
							lane: QueueLane.Shipped,
							tickets: [
								buildTicket({ identifier: 'LO-2', lane: QueueLane.Shipped, workOrderName: 'lo-2-ship-it' }),
								buildTicket({ identifier: 'LO-3', lane: QueueLane.Shipped, question: 'Which branch should it target?' }),
							],
						},
					],
				}),
			},
		});

		const lanes = readLaneTitles();

		expect({
			lanes,
			reason: screen.getByText(/Waiting on a design call/).textContent,
			question: screen.getByText(/Which branch should it target\?/).textContent,
			hrefs: readHrefs(),
		}).toStrictEqual({
			lanes: ['Parked', 'Shipped'],
			reason: expect.stringContaining('Waiting on a design call'),
			question: expect.stringContaining('Which branch should it target?'),
			hrefs: expect.arrayContaining(['/app/work-orders/lo-2-ship-it']),
		});
	});

	test('links a ticket identifier only when the board carries its link', async () => {
		await setupQueueScreen({
			view: {
				drain: buildDrain({
					lanes: [
						{
							lane: QueueLane.Parked,
							tickets: [buildTicket({ identifier: 'LO-1', url: 'https://linear.app/lightsout/issue/LO-1' }), buildTicket({ identifier: 'LO-2' })],
						},
					],
				}),
			},
		});

		const linked = screen.getByRole('link', { name: /LO-1/ });

		expect({
			linkedHref: linked.getAttribute('href'),
			unlinked: screen.queryByRole('link', { name: /LO-2/ }),
			unlinkedShown: screen.getByText(/LO-2/).textContent,
		}).toStrictEqual({ linkedHref: 'https://linear.app/lightsout/issue/LO-1', unlinked: null, unlinkedShown: expect.stringContaining('LO-2') });
	});

	test('draws a ticket the board holds no title for by its identifier alone', async () => {
		await setupQueueScreen({
			view: {
				drain: buildDrain({
					lanes: [{ lane: QueueLane.BuildQueue, tickets: [buildTicket({ identifier: 'LO-4', title: undefined, lane: QueueLane.BuildQueue })] }],
				}),
			},
		});

		const row = screen.getByText('LO-4').closest('li');

		expect({ lanes: readLaneTitles(), row: row?.textContent }).toStrictEqual({ lanes: ['Build Queue'], row: 'LO-4' });
	});

	test('says the drain recorded no tickets when it has no lanes', async () => {
		await setupQueueScreen({ view: { drain: buildDrain({ state: QueueBoardState.Finished, lanes: [] }) } });

		const message = screen.getByText(/This drain recorded no tickets/);

		expect({ shown: message.textContent, lanes: readLaneTitles() }).toStrictEqual({ shown: expect.stringContaining('recorded no tickets'), lanes: [] });
	});
});
