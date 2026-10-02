import { readJsonFile } from '#src/common/utils/readJsonFile.ts';
import { RunFinalReport } from '#src/contracts/run/RunFinalReport.ts';
import { getRunFinalReportPath } from '#src/runState/finalReport/getRunFinalReportPath.ts';

interface Params {
	cwd: string;
	runId: string;
}

export const readRunFinalReport = async ({ cwd, runId }: Params): Promise<RunFinalReport | undefined> => {
	return readJsonFile({ path: await getRunFinalReportPath({ cwd, runId }), schema: RunFinalReport });
};
