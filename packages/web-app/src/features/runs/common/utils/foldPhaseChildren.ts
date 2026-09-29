import type { RunListing } from '@lightsout/engine';
import type { RunGroup } from '#src/features/runs/internal/common/types/RunGroup.ts';

interface Params {
	runs: RunListing[];
}

/**
 * A child whose coordinator is not in the list (filtered away or deleted) is
 * promoted to the top level, so a run never becomes unreachable.
 */
export const foldPhaseChildren = ({ runs }: Params): RunGroup[] => {
	const present = new Set(runs.map((run) => run.runId));
	const childrenByParent = new Map<string, RunListing[]>();

	for (const run of runs) {
		const parent = run.parentRunId;

		if (parent !== undefined && present.has(parent)) {
			childrenByParent.set(parent, [...(childrenByParent.get(parent) ?? []), run]);
		}
	}

	return runs
		.filter((run) => run.parentRunId === undefined || !present.has(run.parentRunId))
		.map((run) => ({ run, children: childrenByParent.get(run.runId) ?? [] }));
};
