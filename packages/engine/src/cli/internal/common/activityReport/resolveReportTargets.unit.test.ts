import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { resolveReportTargets } from '#src/cli/internal/common/activityReport/resolveReportTargets.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';

/**
 * A temp repo whose tickets directory holds a ticket folder of three plans —
 * seeded out of order, so plan-id order is proved rather than inherited from
 * the filesystem — and one work order whose plans folder holds a loose file and
 * no plan.
 */
const setupPlansDir = async () => {
	const cwd = await freshCwd();
	const tickets = join(cwd, '.lightsout', 'work-orders');

	for (const planId of ['003-ship-it', '001-search-basics', '002-queue-order']) {
		await mkdir(join(tickets, 'lo-150-observability', 'plans', planId), { recursive: true });
	}

	await mkdir(join(tickets, 'lo-9-no-plans', 'plans'), { recursive: true });
	await writeFile(join(tickets, 'lo-9-no-plans', 'plans', 'plan.md'), '# Plan\n', 'utf8');

	return { cwd, tickets };
};

test('resolveReportTargets: an address resolves to one plan, and a ticket folder to every plan under it in order', async () => {
	const { cwd } = await setupPlansDir();

	const address = await resolveReportTargets({ cwd, name: 'lo-150-observability/002-queue-order' });
	const workOrderFolder = await resolveReportTargets({ cwd, name: 'lo-150-observability' });

	expect(address).toStrictEqual({ names: ['lo-150-observability/002-queue-order'], workOrderFolder: false });
	expect(workOrderFolder).toStrictEqual({
		names: ['lo-150-observability/001-search-basics', 'lo-150-observability/002-queue-order', 'lo-150-observability/003-ship-it'],
		workOrderFolder: true,
	});
});

test('resolveReportTargets: a work order holding no plan answers an error rather than reporting a loose file', async () => {
	const { cwd, tickets } = await setupPlansDir();

	const resolved = await resolveReportTargets({ cwd, name: 'lo-9-no-plans' });

	expect(resolved).toStrictEqual({ error: `work order 'lo-9-no-plans' holds no plan under ${join(tickets, 'lo-9-no-plans', 'plans')}` });
});

test('resolveReportTargets: an unknown name answers an error naming the value and the plans folder searched', async () => {
	const { cwd, tickets } = await setupPlansDir();

	const resolved = await resolveReportTargets({ cwd, name: 'no-such-plan' });

	// the name that was asked for and the folder that answered, spelled out
	// rather than matched loosely, so a message that grew a second field fails here
	expect(resolved).toStrictEqual({ error: `no plan folder named 'no-such-plan' under ${join(tickets, 'no-such-plan', 'plans')}` });
});

/**
 * A temp repo on the ticket folder layout: one ticket folder holding three plan
 * subfolders inside its `plans/` folder — seeded out of order, so plan-id order
 * is proved rather than inherited from the filesystem — and one branch folder
 * carrying a ship record and no `plans/` folder at all.
 */
const setupTicketsDir = async () => {
	const cwd = await freshCwd();
	const tickets = join(cwd, '.lightsout', 'work-orders');

	for (const planId of ['003-ship-it', '001-search-basics', '002-queue-order']) {
		await mkdir(join(tickets, 'lo-150-observability', 'plans', planId), { recursive: true });
	}

	await mkdir(join(tickets, 'main'), { recursive: true });
	await writeFile(join(tickets, 'main', 'ship.json'), '{}\n', 'utf8');

	return { cwd, tickets };
};

test('resolveReportTargets: a folder with no plans folder is no plan, not a loose-file one', async () => {
	const { cwd, tickets } = await setupTicketsDir();

	const resolved = await resolveReportTargets({ cwd, name: 'main' });

	// the branch has a ticket folder but never carried a plan, so the answer is
	// the error naming the plans folder that was searched — not one plan named 'main'
	expect(resolved).toEqual({ error: expect.stringContaining(join(tickets, 'main', 'plans')) });
});

test('resolveReportTargets: a ticket folder answers its plan addresses, and a missing name names the folder searched', async () => {
	const { cwd, tickets } = await setupTicketsDir();

	const workOrderFolder = await resolveReportTargets({ cwd, name: 'lo-150-observability' });
	const missing = await resolveReportTargets({ cwd, name: 'no-such-plan' });

	expect(workOrderFolder).toStrictEqual({
		names: ['lo-150-observability/001-search-basics', 'lo-150-observability/002-queue-order', 'lo-150-observability/003-ship-it'],
		workOrderFolder: true,
	});
	// the folder actually read, so an error naming a repo-wide plans directory fails here
	expect(missing).toEqual({ error: expect.stringContaining(join(tickets, 'no-such-plan', 'plans')) });
});
