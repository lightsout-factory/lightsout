/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { getWorkOrderEvidenceServerFn } from '#src/features/workOrders/server/getWorkOrderEvidenceServerFn.ts';

/**
 * A repo named through LIGHTSOUT_REPO holding one work order with one plan
 * that has no plan folder — the only seam a test has on the repo root.
 */
const setupWorkOrderRepo = async () => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-work-order-evidence-server-fn-'));
	const folder = join(repoRoot, '.lightsout', 'work-orders', 'lo-7-search-ranking');

	await mkdir(folder, { recursive: true });
	await writeFile(
		join(folder, 'state.json'),
		JSON.stringify({
			schemaVersion: 1,
			name: 'lo-7-search-ranking',
			branch: 'lo-7-search-ranking',
			ticketRef: 'LO-7',
			mode: 'single-plan',
			plans: [{ id: '001-ranking', title: 'Rank by recency', progress: 'ready', createdAt: '2026-01-01T00:00:00.000Z' }],
			history: [{ at: '2026-01-01T00:00:00.000Z', kind: 'plan-added', detail: 'added plan 001-ranking' }],
		}),
		'utf8',
	);
	process.env.LIGHTSOUT_REPO = repoRoot;

	return { heldName: 'lo-7-search-ranking', missingName: 'never-filed' };
};

afterEach(() => {
	delete process.env.LIGHTSOUT_REPO;
});

describe('getWorkOrderEvidenceServerFn', () => {
	test('answers the evidence totals for a held work order and not-found for an unknown one', async () => {
		const { heldName, missingName } = await setupWorkOrderRepo();

		const answers = await Promise.allSettled([
			getWorkOrderEvidenceServerFn({ data: { name: heldName } }),
			getWorkOrderEvidenceServerFn({ data: { name: missingName } }),
		]);

		expect(answers).toEqual([
			{ status: 'fulfilled', value: expect.objectContaining({ plansCounted: 1, plansCovered: 0, headline: expect.any(Object) }) },
			{ status: 'rejected', reason: expect.objectContaining({ isNotFound: true }) },
		]);
	});
});
