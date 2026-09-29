import { loadRunProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunProgressBlock.ts';
import { getRunFamilyRoot } from '#src/cli/internal/common/runFamily/getRunFamilyRoot.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { listRuns } from '#src/views/listRuns.ts';

interface Params {
	cwd: string;
	/** The run the caller settled on — a coordinator, or the phase child that is moving. The loader climbs to the coordinator itself. */
	runId: string;
}

/**
 * Takes the run the caller chose rather than a family root, because climbing is
 * the step a corrupt coordinator has to be guarded against: `listRuns` skips a
 * root whose manifest will not read, and the chosen run then stands alone.
 *
 * @throws {RunNotFoundError} When no run on disk answers to the given id.
 */
export const loadRunFamilyProgressBlock = async ({ cwd, runId }: Params): Promise<string[]> => {
	const listings = await listRuns({ cwd });
	const chosen = listings.find((run) => run.runId === runId);
	const named = chosen === undefined ? runId : getRunFamilyRoot({ run: chosen });
	const root = listings.some((run) => run.runId === named) ? named : runId;
	const children = listings.filter((run) => run.runId !== root && getRunFamilyRoot({ run }) === root);
	const going = children.find((run) => run.status === RunStatus.Running || run.status === RunStatus.Pending);
	// `listRuns` answers newest updated first, so the first child is the most
	// recently updated one — which is what the gap between phases shows.
	const child = going ?? children[0];
	const { lines } = await loadRunProgressBlock({ cwd, runId: root });

	return child === undefined ? lines : [...lines, '', ...(await loadRunProgressBlock({ cwd, runId: child.runId })).lines];
};
