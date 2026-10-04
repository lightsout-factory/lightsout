import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '#src/common/sha256.ts';
import { standardsScopeFiles } from '#src/pipeline/internal/common/utils/standardsScopeFiles.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';

interface Params {
	run: PipelineRun;
}

/**
 * Bytes are how the step knows what cleanup changed: a report may omit a file it edited, and a
 * timed-out attempt leaves edits behind with no report. An unreadable file is omitted, so a
 * file the round deleted reads as absent.
 */
export const fingerprintScopeFiles = async ({ run }: Params): Promise<Record<string, string>> => {
	const entries = await Promise.all(
		standardsScopeFiles({ run }).map(async (file) => {
			const content = await readFile(join(run.cwd, file)).catch(() => undefined);

			return content === undefined ? [] : [[file, sha256({ content })] as const];
		}),
	);

	return Object.fromEntries(entries.flat());
};
