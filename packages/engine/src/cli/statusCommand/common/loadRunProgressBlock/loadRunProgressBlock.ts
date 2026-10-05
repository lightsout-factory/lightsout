import { renderRunProgress } from '#src/cli/statusCommand/common/loadRunProgressBlock/renderRunProgress.ts';
import type { RunProgress } from '#src/common/types/RunProgress.ts';
import { readRunLiveness } from '#src/runState/readRunLiveness/readRunLiveness.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import { getRunProgress } from '#src/views/getRunProgress.ts';

interface Params {
	cwd: string;
	runId: string;
}

/** @throws {RunNotFoundError} When no run on disk answers to the given id. */
export const loadRunProgressBlock = async ({ cwd, runId }: Params): Promise<{ progress: RunProgress; lines: string[] }> => {
	const manifest = await readRunManifest({ cwd, runId });
	const { live } = await readRunLiveness({ cwd, manifest });
	const progress = await getRunProgress({ cwd, manifest, live });

	return { progress, lines: renderRunProgress({ progress }) };
};
