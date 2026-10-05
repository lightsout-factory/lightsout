import { pausedExitCode } from '#src/cli/common/constants/pausedExitCode.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { isRunPaused } from '#src/runState/liveness/isRunPaused.ts';

interface Params {
	/** Whether the run finished the work it set out to do. */
	ok: boolean;
	manifest: RunManifest;
}

/** The one mapping from a run's result to a command's exit code, so a script driving several commands gets one meaning for a pause. */
export const getRunResultExitCode = ({ ok, manifest }: Params): number => {
	let code = 1;

	if (ok) {
		code = 0;
	} else if (isRunPaused({ status: manifest.status })) {
		code = pausedExitCode;
	}

	return code;
};
