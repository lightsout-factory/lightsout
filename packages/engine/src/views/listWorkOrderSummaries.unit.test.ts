import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { listWorkOrderSummaries } from '#src/views/listWorkOrderSummaries.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

interface ReadableWorkOrder {
	name: string;
	/** The one timestamp the record carries: its single plan's `createdAt`. */
	createdAt: string;
}

/**
 * A repo whose work-orders folder holds the folders a case names, written in the
 * order given. With nothing named, the work-orders folder is never created.
 */
const setupWorkOrders = async ({
	readable = [],
	missingRecord = [],
	corruptRecord = [],
}: {
	readable?: ReadableWorkOrder[];
	missingRecord?: string[];
	corruptRecord?: string[];
} = {}) => {
	const cwd = await freshCwd();
	const folderOf = (name: string) => join(cwd, '.lightsout', 'work-orders', name);

	for (const { name, createdAt } of readable) {
		seedWorkOrderRecord({ cwd, name, plans: [{ id: '001-basics', title: 'Basics', progress: 'implemented', createdAt }] });
	}

	for (const name of missingRecord) {
		await mkdir(folderOf(name), { recursive: true });
	}

	for (const name of corruptRecord) {
		await mkdir(folderOf(name), { recursive: true });
		await writeFile(join(folderOf(name), 'state.json'), '{ not json', 'utf8');
	}

	return { cwd };
};

describe('listWorkOrderSummaries', () => {
	test('lists one summary per work-order folder holding a readable record, newest updated first', async () => {
		const { cwd } = await setupWorkOrders({
			readable: [
				{ name: 'lo-1-older', createdAt: '2026-01-01T00:00:00.000Z' },
				{ name: 'lo-2-newer', createdAt: '2026-03-01T00:00:00.000Z' },
			],
		});

		const summaries = await listWorkOrderSummaries({ cwd });

		expect(summaries.map(({ name, updatedAt }) => ({ name, updatedAt }))).toStrictEqual([
			{ name: 'lo-2-newer', updatedAt: '2026-03-01T00:00:00.000Z' },
			{ name: 'lo-1-older', updatedAt: '2026-01-01T00:00:00.000Z' },
		]);
	});

	test('skips a folder whose record is missing or will not parse, without failing the list', async () => {
		const { cwd } = await setupWorkOrders({
			readable: [{ name: 'lo-3-readable', createdAt: '2026-02-01T00:00:00.000Z' }],
			missingRecord: ['lo-4-no-record'],
			corruptRecord: ['lo-5-corrupt'],
		});

		const summaries = await listWorkOrderSummaries({ cwd });

		expect(summaries.map(({ name }) => name)).toStrictEqual(['lo-3-readable']);
	});

	test('answers an empty list when the work-orders folder does not exist', async () => {
		const { cwd } = await setupWorkOrders();

		const summaries = await listWorkOrderSummaries({ cwd });

		expect(summaries).toStrictEqual([]);
	});
});
