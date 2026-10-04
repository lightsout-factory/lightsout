import { join } from 'node:path';
import { resolveRunDir } from '#src/common/resolveRunDir.ts';

interface Params {
	cwd: string;
	/** The family root's run id — full, or the shortened form a report printed. */
	runId: string;
}

/** @throws {RunNotFoundError} When no run on disk answers to the id. */
export const getRunFinalReportPath = async ({ cwd, runId }: Params): Promise<string> => {
	return join(await resolveRunDir({ cwd, runId }), 'report.json');
};
