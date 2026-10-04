import { readJsonlRecords } from '#src/common/readJsonlRecords.ts';
import { ProgressRecord } from '#src/contracts/run/ProgressRecord.ts';
import { getProgressLogPath } from '#src/runState/progress/common/getProgressLogPath.ts';

interface Params {
	cwd: string;
	runId: string;
}

export const readLastProgressMessage = async ({ cwd, runId }: Params): Promise<string | undefined> => {
	const records = await readJsonlRecords({ path: await getProgressLogPath({ cwd, runId }), schema: ProgressRecord });

	return records.at(-1)?.message;
};
