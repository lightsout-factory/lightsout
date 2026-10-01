import { loadRunFamilyProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunFamilyProgressBlock.ts';
import { printProgressFrame } from '#src/cli/internal/common/render/printProgressFrame.ts';
import type { RunProgress } from '#src/views/common/types/RunProgress.ts';

interface Params {
	cwd: string;
	/** Any run of the family — a coordinator or one of its phase children. The loader climbs to the root itself. */
	runId: string;
}

/**
 * The one screen `status --now` and every watch frame print, so a watch shows
 * exactly what `--now` would. Answers the family root's progress from the same
 * read it painted, so a watch decides whether to go on from what it showed.
 *
 * @throws {RunNotFoundError} When no run on disk answers to the given id.
 */
export const printRunFamilyScreen = async ({ cwd, runId }: Params): Promise<RunProgress> =>
	printProgressFrame(await loadRunFamilyProgressBlock({ cwd, runId }));
