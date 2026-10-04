import { exitCli } from '#src/common/exitCli.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline/runPhasesPipeline.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';

/**
 * Every throw on the way in leaves the sequence exactly resumable, so none is
 * worth a stack trace. The parameter shape is imposed by runPhasesPipeline
 * (functions.md's externally-imposed-signature exemption).
 */
export const runPhasesOrFailFast = async (params: Parameters<typeof runPhasesPipeline>[0]): Promise<PipelineResult> => {
	try {
		return await runPhasesPipeline(params);
	} catch (error) {
		console.error(`\n${error instanceof RunLockError ? error.message : messageOf({ error })}`);
		return exitCli({ code: 1 });
	}
};
