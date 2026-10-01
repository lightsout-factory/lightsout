import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { readRunFinalReport } from '#src/runState/finalReport/readRunFinalReport.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';

interface Params {
	cwd: string;
	/** A run already resolved on disk — a family root or one of its phase children. */
	runId: string;
}

const readFamilyRoot = async ({ cwd, runId }: { cwd: string; runId: string }) => {
	const named = await readRunManifest({ cwd, runId }).catch(() => undefined);

	return named?.parentRunId === undefined ? named : readRunManifest({ cwd, runId: named.parentRunId }).catch(() => undefined);
};

/**
 * The family root's saved report, printed only once the root has finished: a
 * root that is going again may still hold a report an earlier command saved,
 * and only the command that last ended the run speaks for it.
 */
export const printRunFinalReport = async ({ cwd, runId }: Params): Promise<void> => {
	const root = await readFamilyRoot({ cwd, runId });
	const finished = root !== undefined && root.status !== RunStatus.Running && root.status !== RunStatus.Pending;
	const report = finished ? await readRunFinalReport({ cwd, runId: root.runId }) : undefined;

	for (const line of report?.lines ?? []) {
		console.log(line);
	}
};
