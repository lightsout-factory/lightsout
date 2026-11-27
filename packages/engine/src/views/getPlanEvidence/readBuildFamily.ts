import { formatShortRunId } from '@lightsout/shared';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';
import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { summarizeRun } from '#src/runState/summarizeRun/summarizeRun.ts';
import type { BuildRun } from '#src/views/getPlanEvidence/common/types/BuildRun.ts';

interface Params {
	cwd: string;
	/** The work order's folder name; names it in a problem line. */
	workOrderName: string;
	/** `WorkOrderPlan.implementation.runId`. */
	runId: string;
}

/** One run read whole, or undefined when its manifest, summary or folder will not read. */
const readBuildRun = async ({ cwd, runId }: { cwd: string; runId: string }): Promise<BuildRun | undefined> => {
	try {
		const manifest = await readRunManifest({ cwd, runId });
		const [summary, runDir] = await Promise.all([summarizeRun({ cwd, manifest }), resolveRunDir({ cwd, runId })]);

		return { manifest, summary, runDir };
	} catch {
		return undefined;
	}
};

/**
 * The build run, then the phase children its own step reports name, in its step order. The
 * run listing is not used: it silently skips a manifest it cannot read, so it could never name one.
 */
export const readBuildFamily = async ({ cwd, workOrderName, runId }: Params): Promise<{ runs: BuildRun[]; problems: string[] }> => {
	const runs: BuildRun[] = [];
	const problems: string[] = [];
	const unreadable = ({ id }: { id: string }) => `run ${formatShortRunId({ runId: id })} of ${workOrderName} could not be read`;
	const build = await readBuildRun({ cwd, runId });

	if (build === undefined) {
		return { runs, problems: [unreadable({ id: runId })] };
	}

	runs.push(build);

	const childIds = [...new Set(build.manifest.steps.flatMap((step) => PhaseReport.safeParse(step.report).data?.runId ?? []))];

	for (const childId of childIds) {
		const child = await readBuildRun({ cwd, runId: childId });

		if (child === undefined) {
			problems.push(unreadable({ id: childId }));
		} else {
			runs.push(child);
		}
	}

	return { runs, problems };
};
