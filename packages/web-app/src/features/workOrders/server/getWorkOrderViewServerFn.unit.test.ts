/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { getWorkOrderViewServerFn } from '#src/features/workOrders/server/getWorkOrderViewServerFn.ts';

/**
 * A repo named through LIGHTSOUT_REPO holding one work order with one plan
 * implemented and nothing shipped — the only seam a test has on the repo root.
 */
const setupWorkOrderRepo = async () => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-work-order-server-fn-'));
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
			plans: [{ id: '001-ranking', title: 'Rank by recency', progress: 'implemented', createdAt: '2026-01-01T00:00:00.000Z' }],
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

describe('getWorkOrderViewServerFn', () => {
	test("answers a held work order's view and not-found for a name no folder holds", async () => {
		const { heldName, missingName } = await setupWorkOrderRepo();

		const answers = await Promise.allSettled([
			getWorkOrderViewServerFn({ data: { name: heldName } }),
			getWorkOrderViewServerFn({ data: { name: missingName } }),
		]);

		expect(answers).toEqual([
			{
				status: 'fulfilled',
				value: expect.objectContaining({
					summary: expect.objectContaining({ name: 'lo-7-search-ranking', branch: 'lo-7-search-ranking', ticketRef: 'LO-7' }),
					plans: [expect.objectContaining({ id: '001-ranking', title: 'Rank by recency', progress: 'implemented' })],
				}),
			},
			{ status: 'rejected', reason: expect.objectContaining({ isNotFound: true }) },
		]);
	});
});
