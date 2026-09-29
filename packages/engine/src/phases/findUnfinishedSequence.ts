import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { listRunIds } from '#src/runState/listRunIds.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';

interface Params {
	cwd: string;
	/** The plan a fresh sequence would be started for, or undefined when the overview belongs to no plan. */
	planName: string | undefined;
}

/**
 * A failed or paused sequence stopped short — resume continues it, so starting
 * a second one for the same plan would run phases twice.
 *
 * Matches the plan each coordinator recorded rather than its overview path's
 * spelling, so a re-spelled path cannot hide a mid-flight sequence.
 */
export const findUnfinishedSequence = async ({ cwd, planName }: Params): Promise<RunManifest | undefined> => {
	if (planName === undefined) {
		return undefined;
	}

	const runIds = await listRunIds({ cwd });
	const unfinished: RunManifest[] = [];

	for (const runId of runIds) {
		const manifest = await readRunManifest({ cwd, runId }).catch(() => undefined);

		if (manifest?.pipeline === PipelineKind.Phases && manifest.planName === planName && manifest.status !== RunStatus.Passed) {
			unfinished.push(manifest);
		}
	}

	return unfinished.sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))[0];
};
