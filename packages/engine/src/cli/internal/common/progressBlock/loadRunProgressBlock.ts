import { renderRunProgress } from '#src/cli/internal/common/render/renderRunProgress.ts';
import { readRunProcessLock } from '#src/runState/lock/readRunProcessLock.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import type { RunProgress } from '#src/views/common/types/RunProgress.ts';
import { getRunProgress } from '#src/views/getRunProgress.ts';

interface Params {
	cwd: string;
	runId: string;
}

/** @throws {RunNotFoundError} When no run on disk answers to the given id. */
export const loadRunProgressBlock = async ({ cwd, runId }: Params): Promise<{ progress: RunProgress; lines: string[] }> => {
	const manifest = await readRunManifest({ cwd, runId });
	const lock = await readRunProcessLock({ cwd, manifest });
	const progress = await getRunProgress({ cwd, manifest, lock });

	return { progress, lines: renderRunProgress({ progress }) };
};
