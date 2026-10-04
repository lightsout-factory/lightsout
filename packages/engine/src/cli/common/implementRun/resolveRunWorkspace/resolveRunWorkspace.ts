import { resolveWorktreeIsolation } from '#src/cli/common/args/resolveWorktreeIsolation/resolveWorktreeIsolation.ts';
import { resolveRunBranch } from '#src/cli/common/implementRun/resolveRunWorkspace/resolveRunBranch.ts';
import type { RunWorkspace } from '#src/cli/common/types/RunWorkspace.ts';
import { isSamePath } from '#src/common/isSamePath.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import type { CommandContext } from '#src/common/types/CommandContext.ts';
import type { WorktreeFailure } from '#src/common/types/WorktreeFailure.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';
import { readLiveRunLock } from '#src/runState/lock/readLiveRunLock.ts';
import { createWorktree } from '#src/worktree/createWorktree.ts';
import { fetchDefaultBranch } from '#src/worktree/fetchDefaultBranch.ts';
import { prepareWorkOrderBranch } from '#src/worktree/prepareWorkOrderBranch/prepareWorkOrderBranch.ts';
import { readBranchWorktree } from '#src/worktree/readBranchWorktree.ts';
import { readWorktreeRecord } from '#src/worktree/records/readWorktreeRecord.ts';
import { writeWorktreeRecord } from '#src/worktree/records/writeWorktreeRecord.ts';
import { resolveWorktreePath } from '#src/worktree/resolveWorktreePath.ts';

interface Params {
	/** The checkout the command was launched from — `--cwd`, or the process directory. */
	cwd: string;
	config: LightsoutConfig;
	flags: CommandContext['flags'];
	/** `--plan` exactly as the user typed it, for a plan-based run. Forwarded to `resolveRunBranch`. */
	planPath?: string;
	/** `--ticket` exactly as the user typed it, for a direct run. Forwarded to `resolveRunBranch`. */
	ticketPath?: string;
	/** `--ref` exactly as the user typed it, when a direct run named one. Forwarded to `resolveRunBranch`. */
	ticketRef?: string;
	onProgress?: (message: string) => void;
}

interface ResolvedTree {
	path: string;
	created: boolean;
}

/**
 * Only a recorded tree at the branch's own path qualifies. For a run that
 * belongs to no work order the record must name the `plan` owner, since a tree
 * an implementation run owns is not a second run's. For a plan address an
 * `implement` record qualifies too, because every plan of a ticket builds in
 * the one tree; the run lock is what separates a finished run's tree from a
 * live one.
 *
 * The record is re-stamped to `implement` because that stamp is the licence the
 * post-ship cleanup reads. `worktree.setup` does not run again.
 */
const adoptPlanningTree = async ({
	cwd,
	branch,
	addressed,
	holder,
	onProgress,
}: {
	cwd: string;
	branch: string;
	addressed: boolean;
	holder: string;
	onProgress?: (message: string) => void;
}): Promise<ResolvedTree | WorktreeFailure | undefined> => {
	const worktreePath = await resolveWorktreePath({ cwd, branch });
	const record = await readWorktreeRecord({ cwd, branch });
	const owners: WorktreeOwner[] = addressed ? [WorktreeOwner.Plan, WorktreeOwner.Implement] : [WorktreeOwner.Plan];

	if (record === undefined || !owners.includes(record.owner) || !(await isSamePath({ path: holder, otherPath: worktreePath }))) {
		return undefined;
	}

	const live = addressed ? await readLiveRunLock({ cwd: worktreePath }) : undefined;

	if (live !== undefined) {
		return { error: `the worktree at ${worktreePath} cannot be built in: run ${live.runId} is using it right now — wait for it, or pass --no-worktree` };
	}

	await writeWorktreeRecord({ cwd, branch, owner: WorktreeOwner.Implement, worktreePath, startPoint: record.startPoint, onProgress });

	return { path: worktreePath, created: false };
};

/**
 * Nothing here falls back to the launching checkout: a gate run against the
 * tree the user happened to be standing on judges code the run is not building.
 */
const cutWorkspace = async ({
	cwd,
	config,
	branch,
	addressed,
	onProgress,
}: {
	cwd: string;
	config: LightsoutConfig;
	branch: string;
	addressed: boolean;
	onProgress?: (message: string) => void;
}): Promise<ResolvedTree | WorktreeFailure> => {
	// A later plan of a ticket must be built on the implementation its branch
	// already carries, so the ticket branch is settled before anything is adopted
	// or cut.
	const prepared = addressed ? await prepareWorkOrderBranch({ cwd, branch }) : { startPoint: undefined };

	if ('error' in prepared) {
		return prepared;
	}

	const holder = await readBranchWorktree({ cwd, branch });

	if (holder !== undefined) {
		return (
			(await adoptPlanningTree({ cwd, branch, addressed, holder, onProgress })) ?? {
				error: `'${branch}' is already checked out at ${holder} — pass --no-worktree to build in that checkout deliberately`,
			}
		);
	}

	// A failed fetch stops the run rather than cutting from a stale base. It comes
	// after the adopt branch above, so a run continuing in an existing tree never
	// fails for a network that was down.
	let startPoint = prepared.startPoint;

	if (startPoint === undefined) {
		const defaultBranch = await fetchDefaultBranch({ cwd });

		if (typeof defaultBranch !== 'string') {
			return defaultBranch;
		}

		startPoint = `origin/${defaultBranch}`;
	}

	// `reuseExisting: false` is what separates a standalone run from a drain: the
	// queue continues in a tree an earlier drain parked, and a standalone run
	// must not silently adopt a directory nobody claimed.
	const created = await createWorktree({
		cwd,
		branch,
		startPoint,
		setup: config.worktree?.setup,
		owner: WorktreeOwner.Implement,
		reuseExisting: false,
		onProgress,
	});

	if (typeof created !== 'string') {
		return created;
	}

	return { path: created, created: true };
};

/**
 * The branch is resolved only once isolation is decided: a run with isolation
 * off never needs one, so resolving it first would refuse a `--no-worktree` run
 * whose input names no work order.
 */
export const resolveRunWorkspace = async ({
	cwd,
	config,
	flags,
	planPath,
	ticketPath,
	ticketRef,
	onProgress,
}: Params): Promise<RunWorkspace | { error: string }> => {
	const isolated = resolveWorktreeIsolation({ flags, configured: config.implement?.worktree });

	if (typeof isolated !== 'boolean') {
		return isolated;
	}

	if (!isolated) {
		return { cwd, isolated: false, created: false };
	}

	const branch = await resolveRunBranch({ cwd, planPath, ticketPath, ticketRef });

	if (typeof branch !== 'string') {
		return branch;
	}

	const planName = planPath === undefined ? undefined : await planNameFromPath({ cwd, planPath });
	const addressed = planName !== undefined && parsePlanAddress({ name: planName }) !== undefined;
	const workspace = await cutWorkspace({ cwd, config, branch, addressed, onProgress });

	return 'error' in workspace ? workspace : { cwd: workspace.path, branch, isolated: true, created: workspace.created };
};
