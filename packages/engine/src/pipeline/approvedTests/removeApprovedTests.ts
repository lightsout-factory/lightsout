import { rm } from 'node:fs/promises';
import { approvedTestsDir } from '#src/pipeline/approvedTests/internal/common/utils/approvedTestsDir.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';

interface Params {
	run: PipelineRun;
}

/** The manifest records and the review journal stay: they are the evidence, the copies only a resume's baseline. */
export const removeApprovedTests = async ({ run }: Params): Promise<void> => {
	await rm(await approvedTestsDir({ cwd: run.cwd, runId: run.current().runId }), { recursive: true, force: true });
};
