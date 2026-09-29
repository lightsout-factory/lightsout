import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';

/**
 * A RunLockError created no run state, so it is not worth a stack trace. The
 * parameter shape is imposed by runImplementPipeline (functions.md's
 * externally-imposed-signature exemption).
 */
export const runPipelineOrFailFast = async (params: Parameters<typeof runImplementPipeline>[0]): Promise<PipelineResult> => {
	try {
		return await runImplementPipeline(params);
	} catch (error) {
		if (error instanceof RunLockError) {
			console.error(`\n${error.message}`);
			return exitCli({ code: 1 });
		}

		throw error;
	}
};
