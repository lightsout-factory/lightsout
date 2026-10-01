import { loadRunProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunProgressBlock.ts';
import { getRunFamilyRoot } from '#src/cli/internal/common/runFamily/getRunFamilyRoot.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { findRunningChildRunId } from '#src/runState/common/utils/findRunningChildRunId.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';
import type { RunProgress } from '#src/views/common/types/RunProgress.ts';
import { listRuns } from '#src/views/listRuns.ts';

/**
 * The child the root's running step names is the moving one — the same rule
 * `isRunLive` judges by, so the screen never paints an orphan as moving. A named
 * child with no manifest yet has not started, so nothing is shown beside the
 * root. Only a root whose running step names no child falls back to update
 * times.
 */
const chooseChild = async ({ cwd, root, children }: { cwd: string; root: string; children: RunListing[] }) => {
	const rootManifest = await readRunManifest({ cwd, runId: root }).catch(() => undefined);
	const namedChildId = rootManifest === undefined ? undefined : findRunningChildRunId({ manifest: rootManifest });

	// `listRuns` answers newest updated first, so the first child is the most
	// recently updated one — which is what the gap between phases shows.
	return namedChildId === undefined
		? (children.find((run) => run.status === RunStatus.Running || run.status === RunStatus.Pending) ?? children[0])
		: children.find((run) => run.runId === namedChildId);
};

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
 * @returns the family root's progress — the chosen run's own when its coordinator will not read — beside the screen's lines
 * @throws {RunNotFoundError} When no run on disk answers to the given id.
 */
export const loadRunFamilyProgressBlock = async ({ cwd, runId }: Params): Promise<{ progress: RunProgress; lines: string[] }> => {
	const listings = await listRuns({ cwd });
	const chosen = listings.find((run) => run.runId === runId);
	const named = chosen === undefined ? runId : getRunFamilyRoot({ run: chosen });
	const root = listings.some((run) => run.runId === named) ? named : runId;
	const children = listings.filter((run) => run.runId !== root && getRunFamilyRoot({ run }) === root);
	const child = await chooseChild({ cwd, root, children });
	const { progress, lines } = await loadRunProgressBlock({ cwd, runId: root });

	return { progress, lines: child === undefined ? lines : [...lines, '', ...(await loadRunProgressBlock({ cwd, runId: child.runId })).lines] };
};
