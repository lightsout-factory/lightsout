import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { z } from 'zod';
import type { PlanWorkspaceFile } from '#src/contracts/views/planWorkspace/PlanWorkspaceFile.ts';
import { readPlanRecord } from '#src/views/getPlanWorkspace/readPlanRecord.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';

const schema = z.object({ planName: z.string() });

/** A workspace file entry pointing at `decisions.json`, written with whatever text a case wants inside it. */
const seedRecord = async ({ raw }: { raw?: string }) => {
	const cwd = await freshCwd();
	const dir = join(cwd, '.lightsout', 'work-orders', 'add-search', 'plans');
	const file: PlanWorkspaceFile = {
		name: 'decisions.json',
		path: '.lightsout/work-orders/add-search/plans/decisions.json',
		bytes: 0,
		updatedAt: '2026-01-01T00:00:00.000Z',
	};

	await mkdir(dir, { recursive: true });

	if (raw !== undefined) {
		await writeFile(join(dir, 'decisions.json'), raw, 'utf8');
	}

	return { dir, file };
};

test('a record that parses comes back as the value, with nothing to report', async () => {
	const { dir, file } = await seedRecord({ raw: JSON.stringify({ planName: 'add-search' }) });

	expect(await readPlanRecord({ dir, file, schema })).toStrictEqual({ value: { planName: 'add-search' } });
});

test('a workspace that does not have the record gets nothing back, and that is not a problem', async () => {
	const { dir } = await seedRecord({});

	// no file passed is how a caller spells "this workspace has no decisions.json"
	expect(await readPlanRecord({ dir, file: undefined, schema })).toStrictEqual({});
});

test('a record that is on the listing and not on disk says so rather than throwing', async () => {
	const { dir, file } = await seedRecord({});

	expect(await readPlanRecord({ dir, file, schema })).toStrictEqual({ problem: 'decisions.json could not be read' });
});

test('a record that is not JSON at all names the file rather than surfacing a parser error', async () => {
	const { dir, file } = await seedRecord({ raw: '{ not json' });

	expect(await readPlanRecord({ dir, file, schema })).toStrictEqual({ problem: 'decisions.json is not valid JSON' });
});

test('a record that parses and does not match its contract says which of the two went wrong', async () => {
	const { dir, file } = await seedRecord({ raw: JSON.stringify({ planName: 42 }) });

	const { problem, value } = await readPlanRecord({ dir, file, schema });

	// the viewer shows the broken file; it is the pipeline's readers that refuse to proceed
	expect({ starts: problem?.startsWith('decisions.json does not match its contract: '), value }).toStrictEqual({ starts: true, value: undefined });
});

/** A workspace folder holding `decisions.json`, listed under a repo-relative path that resolves to nothing. */
const setupRecordInFolder = async () => {
	const dir = await freshCwd();
	const file: PlanWorkspaceFile = {
		name: 'decisions.json',
		path: '.lightsout/work-orders/nowhere/plans/decisions.json',
		bytes: 0,
		updatedAt: '2026-01-01T00:00:00.000Z',
	};

	await writeFile(join(dir, 'decisions.json'), JSON.stringify({ planName: 'add-search' }), 'utf8');

	return { dir, file };
};

test('reads the record from the folder it is handed, not from a path joined to a checkout', async () => {
	const { dir, file } = await setupRecordInFolder();

	const result = await readPlanRecord({ dir, file, schema });

	expect(result).toStrictEqual({ value: { planName: 'add-search' } });
});
