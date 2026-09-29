import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { pausedExitCode } from '#src/cli/internal/common/constants/pausedExitCode.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { isRunPaused } from '#src/runState/isRunPaused.ts';

interface Params {
	/** Whether the run finished the work it set out to do. */
	ok: boolean;
	manifest: RunManifest;
}

/** Every run-driving command exits through here, so a script driving several gets one meaning for a pause. */
export const exitForRunResult = ({ ok, manifest }: Params): Promise<never> => {
	if (ok) {
		return exitCli({ code: 0 });
	}

	return exitCli({ code: isRunPaused({ status: manifest.status }) ? pausedExitCode : 1 });
};
