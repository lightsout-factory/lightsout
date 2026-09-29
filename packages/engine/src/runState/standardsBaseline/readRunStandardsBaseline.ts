import { readJsonFile } from '#src/common/utils/readJsonFile.ts';
import { StandardsSnapshot } from '#src/contracts/standardsCheck/StandardsSnapshot.ts';
import { getRunStandardsBaselinePath } from '#src/runState/standardsBaseline/internal/getRunStandardsBaselinePath.ts';

interface Params {
	cwd: string;
	runId: string;
}

/**
 * `undefined`, never a throw, when the file is absent, unparseable or fails the
 * contract: a resumed run can have no baseline, and "no comparison point" is a
 * state cleanup renders rather than an error.
 */
export const readRunStandardsBaseline = async ({ cwd, runId }: Params): Promise<StandardsSnapshot | undefined> => {
	return readJsonFile({ path: await getRunStandardsBaselinePath({ cwd, runId }), schema: StandardsSnapshot });
};
