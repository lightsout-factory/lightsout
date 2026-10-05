import { access } from 'node:fs/promises';
import { getLaunchLogPath } from '#src/cli/common/detach/getLaunchLogPath.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { readRunFinalReport } from '#src/runState/finalReport/readRunFinalReport.ts';
import { readRunLiveness } from '#src/runState/readRunLiveness/readRunLiveness.ts';
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
 * A detached engine's crash reason is only in its launch log, so the log is
 * named when nothing else explains how the run ended: the root is stopped, or
 * finished with no saved report. A run started in the foreground has no log.
 */
const readExplainingLaunchLog = async ({ cwd, root, finished, saved }: { cwd: string; root: RunManifest; finished: boolean; saved: boolean }) => {
	const stopped = !finished && !(await readRunLiveness({ cwd, manifest: root })).live;

	if (!stopped && (!finished || saved)) {
		return undefined;
	}

	const logPath = await getLaunchLogPath({ cwd, runId: root.runId });

	return access(logPath).then(
		() => logPath,
		() => undefined,
	);
};

/**
 * The family root's saved report, printed only once the root has finished: a
 * root that is going again may still hold a report an earlier command saved,
 * and only the command that last ended the run speaks for it. The root's launch
 * log follows when the run stopped, or finished without saving a report.
 */
export const printRunFinalReport = async ({ cwd, runId }: Params): Promise<void> => {
	const root = await readFamilyRoot({ cwd, runId });
	const finished = root !== undefined && root.status !== RunStatus.Running && root.status !== RunStatus.Pending;
	const report = finished ? await readRunFinalReport({ cwd, runId: root.runId }) : undefined;
	const launchLog = root === undefined ? undefined : await readExplainingLaunchLog({ cwd, root, finished, saved: report !== undefined });

	for (const line of report?.lines ?? []) {
		console.log(line);
	}

	if (launchLog !== undefined) {
		console.log(`engine output: ${launchLog}`);
	}
};
