import type { ActivityNode } from '#src/contracts/activity/ActivityNode.ts';
import type { HarnessProcessMark } from '#src/contracts/activity/HarnessProcessMark.ts';

interface Params {
	/** The levels to gather from — one report's roots, or every report's roots of a ticket. */
	nodes: ActivityNode[];
}

/**
 * Raw processes rather than children's totals: the union of windows and the
 * peak overlap cannot be rebuilt from totals that already added them up.
 */
export const gatherNodeProcesses = ({ nodes }: Params): HarnessProcessMark[] =>
	nodes.flatMap((node) => [...node.processes, ...gatherNodeProcesses({ nodes: node.children })]);
