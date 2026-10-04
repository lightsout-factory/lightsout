import { readJsonFile } from '#src/common/utils/readJsonFile.ts';
import { RunOwner } from '#src/contracts/run/RunOwner.ts';
import { getRunOwnerPath } from '#src/runState/owner/common/getRunOwnerPath.ts';

interface Params {
	cwd: string;
	runId: string;
}

/** Undefined when the run has no owner record, or one that will not parse. */
export const readRunOwner = async ({ cwd, runId }: Params): Promise<RunOwner | undefined> => {
	return readJsonFile({ path: await getRunOwnerPath({ cwd, runId }), schema: RunOwner });
};
