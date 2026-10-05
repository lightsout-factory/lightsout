import { printConfigSource } from '#src/cli/common/render/printConfigSource.ts';
import { loadRunFamilyProgressBlock } from '#src/cli/statusCommand/common/loadRunFamilyProgressBlock.ts';
import { printProgressFrame } from '#src/cli/statusCommand/common/printRunFamilyScreen/printProgressFrame.ts';
import type { RunProgress } from '#src/common/types/RunProgress.ts';

interface Params {
	cwd: string;
	/** Any run of the family — a coordinator or one of its phase children. The loader climbs to the root itself. */
	runId: string;
}

/**
 * The one screen `status --now`, `status --run` and every watch frame print, so
 * a watch shows exactly what a one-shot status would. Answers the family root's progress from the same
 * read it painted, so a watch decides whether to go on from what it showed.
 * The screen ends with the root's recorded config path; the queue board reads
 * `loadRunFamilyProgressBlock` itself, so its ticket blocks never show it.
 *
 * @throws {RunNotFoundError} When no run on disk answers to the given id.
 */
export const printRunFamilyScreen = async ({ cwd, runId }: Params): Promise<RunProgress> => {
	const progress = printProgressFrame(await loadRunFamilyProgressBlock({ cwd, runId }));

	// A run that predates the record has no path; printConfigSource would claim the checkout has no config.
	if (progress.configPath !== undefined) {
		printConfigSource({ configPath: progress.configPath });
	}

	return progress;
};
