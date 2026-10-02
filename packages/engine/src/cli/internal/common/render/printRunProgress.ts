import { loadRunProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunProgressBlock.ts';
import { printProgressFrame } from '#src/cli/internal/common/render/printProgressFrame.ts';
import type { RunProgress } from '#src/views/common/types/RunProgress.ts';

interface Params {
	cwd: string;
	runId: string;
}

/** @throws {RunNotFoundError} When no run on disk answers to the given id. */
export const printRunProgress = async ({ cwd, runId }: Params): Promise<RunProgress> => printProgressFrame(await loadRunProgressBlock({ cwd, runId }));
