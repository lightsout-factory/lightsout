import { getRunResultExitCode } from '#src/cli/common/getRunResultExitCode.ts';
import { exitCli } from '#src/common/exitCli.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';

interface Params {
	/** Whether the run finished the work it set out to do. */
	ok: boolean;
	manifest: RunManifest;
}

/** Every run-driving command exits through here, so a script driving several gets one meaning for a pause. */
export const exitForRunResult = ({ ok, manifest }: Params): Promise<never> => exitCli({ code: getRunResultExitCode({ ok, manifest }) });
