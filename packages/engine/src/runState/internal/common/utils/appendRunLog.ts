import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveRunDir } from '#src/runState/common/paths/resolveRunDir.ts';

interface Params {
	cwd: string;
	runId: string;
	/** JSONL file within the run dir, e.g. `agents.jsonl`. */
	fileName: string;
	/** One record, serialized as a single JSON line. */
	record: unknown;
}

/** The directory is looked up rather than joined, so an append never creates a run folder in a location nothing will read back. */
export const appendRunLog = async ({ cwd, runId, fileName, record }: Params): Promise<void> => {
	const dir = await resolveRunDir({ cwd, runId });

	await mkdir(dir, { recursive: true });
	await appendFile(join(dir, fileName), `${JSON.stringify(record)}\n`, 'utf8');
};
