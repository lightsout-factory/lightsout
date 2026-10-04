import { readdir } from 'node:fs/promises';
import { getWorkOrderRunsDir } from '#src/common/runs/getWorkOrderRunsDir.ts';
import { listRunLocations } from '#src/common/runs/listRunLocations.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';

interface Params {
	cwd: string;
	/** Narrow the read to one ticket's runs folder. Without it, every location a run can sit in. */
	workOrderName?: string;
}

/**
 * Narrowing to one ticket stops listing one plan's runs from opening every
 * manifest there is. A location that has never held a run is an empty list, so
 * cross-run reports work on a repo with no history.
 */
export const listRunIds = async ({ cwd, workOrderName }: Params): Promise<string[]> => {
	const locations =
		workOrderName === undefined
			? await listRunLocations({ cwd })
			: [getWorkOrderRunsDir({ workOrderFolder: await workOrderFolderDir({ cwd, name: workOrderName }) })];
	const runIds: string[] = [];

	for (const location of locations) {
		const entries = await readdir(location, { withFileTypes: true }).catch(() => []);

		// Only a directory holds a manifest, so stray files are never runs.
		runIds.push(...entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
	}

	return runIds.sort();
};
