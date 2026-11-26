/**
 * @jest-environment node
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { isNotFound } from '@tanstack/react-router';
import { listWorkOrderSummariesServerFn } from '#src/features/workOrders/server/listWorkOrderSummariesServerFn.ts';

/** The one recorded time the work order carries, so it is the newest one too. */
const recordedAt = '2026-02-01T00:00:00.000Z';

/** A single-plan record holding one plan still ready, which derives planning with none of one plan done. */
const recordText = JSON.stringify({
	schemaVersion: 1,
	name: 'search-ranking',
	branch: 'search-ranking',
	ticketRef: 'LO-7',
	mode: 'single-plan',
	plans: [{ id: '001-ranking', title: 'Ranking', progress: 'ready', createdAt: recordedAt }],
	history: [{ at: recordedAt, kind: 'plan-added', detail: 'added plan 001-ranking' }],
});

/**
 * A repo holding one work order, named to the server function through
 * LIGHTSOUT_REPO — the only seam a test has on the repo root — and, on the
 * public site, refused even though the repo is there.
 */
const setupWorkOrderRepo = async ({ publicSite }: { publicSite: boolean }) => {
	const repoRoot = await mkdtemp(join(tmpdir(), 'lightsout-summaries-server-fn-'));
	const folder = join(repoRoot, '.lightsout', 'work-orders', 'search-ranking');

	await mkdir(folder, { recursive: true });
	await writeFile(join(folder, 'state.json'), recordText, 'utf8');
	process.env.LIGHTSOUT_REPO = repoRoot;

	if (publicSite) {
		process.env.LIGHTSOUT_PUBLIC = '1';
	}
};

/** The summaries the server function answered, or whether its refusal was the router's not-found signal. */
const listSummariesOrRefusal = async () => {
	try {
		const summaries = await listWorkOrderSummariesServerFn();

		return {
			summaries: summaries.map(({ name, ticketRef, branch, status, plansDone, plansTotal, updatedAt, live }) => ({
				name,
				ticketRef,
				branch,
				status,
				plansDone,
				plansTotal,
				updatedAt,
				live,
			})),
		};
	} catch (error) {
		return { notFound: isNotFound(error) };
	}
};

afterEach(() => {
	delete process.env.LIGHTSOUT_REPO;
	delete process.env.LIGHTSOUT_PUBLIC;
});

describe('listWorkOrderSummariesServerFn', () => {
	test.each([
		{
			publicSite: false,
			expected: {
				summaries: [
					{
						name: 'search-ranking',
						ticketRef: 'LO-7',
						branch: 'search-ranking',
						status: 'planning',
						plansDone: 0,
						plansTotal: 1,
						updatedAt: '2026-02-01T00:00:00.000Z',
						live: false,
					},
				],
			},
		},
		{ publicSite: true, expected: { notFound: true } },
	])('answers the summaries the reader lists, and refuses with not-found on the public site', async ({ publicSite, expected }) => {
		await setupWorkOrderRepo({ publicSite });

		const outcome = await listSummariesOrRefusal();

		expect(outcome).toStrictEqual(expected);
	});
});
