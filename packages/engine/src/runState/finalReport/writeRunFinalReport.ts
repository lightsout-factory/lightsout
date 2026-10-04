import { writeJsonFile } from '#src/common/json/writeJsonFile.ts';
import type { RunFinalReport } from '#src/contracts/run/RunFinalReport.ts';
import { getRunFinalReportPath } from '#src/runState/finalReport/getRunFinalReportPath.ts';

interface Params {
	cwd: string;
	/** The family root's run id: a phased run's coordinator, or the run itself. */
	runId: string;
	report: RunFinalReport;
}

/**
 * Written atomically, so a reader never sees half a report. It creates no
 * folder: a run folder only exists once the run made it.
 *
 * @throws {RunNotFoundError} When no run on disk answers to the id.
 */
export const writeRunFinalReport = async ({ cwd, runId, report }: Params): Promise<void> => {
	await writeJsonFile({ path: await getRunFinalReportPath({ cwd, runId }), value: report, atomic: true });
};
