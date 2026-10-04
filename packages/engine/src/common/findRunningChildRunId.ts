import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';

interface Params {
	/** A phased coordinator's manifest. */
	manifest: RunManifest;
}

/** The phase child the coordinator's running step names, recorded before that child starts; undefined when no running step names one. */
export const findRunningChildRunId = ({ manifest }: Params): string | undefined => {
	const running = manifest.steps.find((step) => step.status === RunStatus.Running);

	return PhaseReport.safeParse(running?.report).data?.runId;
};
