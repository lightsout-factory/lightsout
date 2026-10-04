import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { writeJsonFile } from '#src/common/json/writeJsonFile.ts';
import type { StandardsSnapshot } from '#src/contracts/standardsCheck/StandardsSnapshot.ts';
import { getRunStandardsBaselinePath } from '#src/runState/standardsBaseline/common/getRunStandardsBaselinePath.ts';

interface Params {
	cwd: string;
	runId: string;
	snapshot: StandardsSnapshot;
}

/**
 * The findings before the run's first agent turn, which later tell a violation
 * this run made from debt it inherited.
 */
export const writeRunStandardsBaseline = async ({ cwd, runId, snapshot }: Params): Promise<void> => {
	const path = await getRunStandardsBaselinePath({ cwd, runId });

	// The first run to reach clean-slate has no run folder yet.
	await mkdir(dirname(path), { recursive: true });
	await writeJsonFile({ path, value: snapshot });
};
