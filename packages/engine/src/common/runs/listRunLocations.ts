import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getCommandRunsDir } from '#src/common/runs/getCommandRunsDir.ts';
import { getWorkOrderRunsDir } from '#src/common/runs/getWorkOrderRunsDir.ts';
import { resolveSharedStateDir } from '#src/common/workspace/resolveSharedStateDir.ts';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';

interface Params {
	cwd: string;
}

/**
 * The primary checkout is resolved twice rather than deriving one directory from
 * the other, because walking up from the tickets directory would assert a
 * layout this file does not own.
 *
 * A location that is not on disk is still listed: a run created after the list
 * was taken must not be missed because the folder was absent when it was built.
 */
export const listRunLocations = async ({ cwd }: Params): Promise<string[]> => {
	const tickets = await workOrdersDir({ cwd });
	const entries = await readdir(tickets, { withFileTypes: true }).catch(() => []);
	const ticketRuns = entries.filter((entry) => entry.isDirectory()).map((entry) => getWorkOrderRunsDir({ workOrderFolder: join(tickets, entry.name) }));
	const stateDir = await resolveSharedStateDir({ cwd });
	// Two pipelines share the implement folder, so the set is what keeps the
	// scan from reading it twice.
	const commandRuns = new Set(Object.values(PipelineKind).map((pipeline) => getCommandRunsDir({ stateDir, pipeline })));

	return [...ticketRuns, ...commandRuns];
};
