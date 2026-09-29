import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { z } from 'zod';

interface Params<Shape> {
	path: string;
	schema: z.ZodType<Shape>;
	/** The entries as reported, before provenance is stamped on. */
	entries: Record<string, unknown>[];
	runId: string;
	step: string;
}

/**
 * A ledger accumulates across runs because a report that keeps recurring is
 * the signal. Provenance is stamped here rather than asked of the caller so
 * every ledger answers "which run, which step, when" the same way. Nothing
 * reported means nothing written: an empty ledger and no ledger are the same
 * absence.
 */
export const appendJsonlRecords = async <Shape>({ path, schema, entries, runId, step }: Params<Shape>): Promise<void> => {
	if (entries.length === 0) {
		return;
	}

	const at = new Date().toISOString();
	const lines = entries.map((entry) => JSON.stringify(schema.parse({ ...entry, at, runId, step }))).join('\n');

	await mkdir(dirname(path), { recursive: true });
	await appendFile(path, `${lines}\n`, 'utf8');
};
