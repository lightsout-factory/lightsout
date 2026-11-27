/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { getReader } from '#src/server/getReader.ts';
import type { LightsoutReader } from '#src/server/LightsoutReader.ts';

interface WorkOrderSeed {
	/** The folder's name under the work-orders directory, which the record names as its own. */
	name: string;
	ticketRef: string;
	/** Every timestamp the record carries, so the seed's newest recorded time is this one. */
	at: string;
}

/** Updated first on disk, and first by name, so only a newest-first sort puts it second. */
const olderWorkOrder: WorkOrderSeed = { name: 'a-older', ticketRef: 'LO-1', at: '2026-01-02T00:00:00.000Z' };

const newerWorkOrder: WorkOrderSeed = { name: 'b-newer', ticketRef: 'LO-2', at: '2026-03-01T00:00:00.000Z' };

/** A single-plan record holding one ready plan, with every timestamp it carries set to the seed's `at`. */
const recordTextOf = ({ name, ticketRef, at }: WorkOrderSeed): string =>
	JSON.stringify({
		schemaVersion: 1,
		name,
		branch: name,
		ticketRef,
		mode: 'single-plan',
		plans: [{ id: '001-groundwork', title: 'Groundwork', progress: 'ready', createdAt: at }],
		history: [{ at, kind: 'plan-added', detail: 'added plan 001-groundwork' }],
	});

/**
 * A temporary repo holding the given work orders and no queue run, pointed at
 * through LIGHTSOUT_REPO — the only seam a test has on the repo root.
 */
const setupWorkOrdersReader = async ({
	workOrders = [olderWorkOrder, newerWorkOrder],
}: {
	workOrders?: WorkOrderSeed[];
} = {}): Promise<{ reader: LightsoutReader }> => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-reader-work-orders-'));

	for (const workOrder of workOrders) {
		const folder = join(repoRoot, '.lightsout', 'work-orders', workOrder.name);

		await mkdir(folder, { recursive: true });
		await writeFile(join(folder, 'state.json'), recordTextOf(workOrder), 'utf8');
	}

	process.env.LIGHTSOUT_REPO = repoRoot;

	return { reader: getReader() };
};

afterEach(() => {
	delete process.env.LIGHTSOUT_REPO;
});

describe('getReader work orders', () => {
	test('lists the work orders of the repo it was opened on, newest first', async () => {
		const { reader } = await setupWorkOrdersReader();

		const summaries = await reader.listWorkOrderSummaries();

		expect(summaries.map(({ name, ticketRef, updatedAt }) => ({ name, ticketRef, updatedAt }))).toStrictEqual([
			{ name: 'b-newer', ticketRef: 'LO-2', updatedAt: '2026-03-01T00:00:00.000Z' },
			{ name: 'a-older', ticketRef: 'LO-1', updatedAt: '2026-01-02T00:00:00.000Z' },
		]);
	});

	test('reads one work order and answers undefined for a name no folder holds', async () => {
		const { reader } = await setupWorkOrdersReader();

		const [view, missing] = await Promise.all([reader.getWorkOrderView({ name: 'a-older' }), reader.getWorkOrderView({ name: 'never-opened' })]);

		expect({
			name: view?.summary.name,
			branch: view?.summary.branch,
			plans: view?.plans.map((plan) => plan.id),
			history: view?.history.map((event) => event.kind),
			missing,
		}).toStrictEqual({
			name: 'a-older',
			branch: 'a-older',
			plans: ['001-groundwork'],
			history: ['plan-added'],
			missing: undefined,
		});
	});

	test("reads a work order's evidence totals and answers undefined for a name no folder holds", async () => {
		const { reader } = await setupWorkOrdersReader();

		const [totals, missing] = await Promise.all([reader.getWorkOrderEvidence({ name: 'a-older' }), reader.getWorkOrderEvidence({ name: 'never-opened' })]);

		expect({
			plansCounted: totals?.plansCounted,
			plansCovered: totals?.plansCovered,
			problems: totals?.problems,
			missing,
		}).toStrictEqual({
			plansCounted: 1,
			plansCovered: 0,
			problems: [],
			missing: undefined,
		});
	});

	test('reads the queue view, answering no drain in a repo whose queue never ran', async () => {
		const { reader } = await setupWorkOrdersReader({ workOrders: [] });

		const view = await reader.getQueueView();

		expect(view.drain).toBeUndefined();
	});
});
