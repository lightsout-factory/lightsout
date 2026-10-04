import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { resolveWorktreeIsolation } from '#src/cli/internal/common/args/resolveWorktreeIsolation.ts';
import type { PlanWorktree } from '#src/cli/plan/internal/common/types/PlanWorktree.ts';
import { readGitHeadCommit } from '#src/common/git/readGitHeadCommit.ts';
import { workOrderNameOf } from '#src/common/planAddress/workOrderNameOf.ts';
import { isSamePath } from '#src/common/utils/isSamePath.ts';
import { readWorkOrderRecordFile } from '#src/common/workspace/readWorkOrderRecordFile.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import { readLiveRunLock } from '#src/runState/lock/readLiveRunLock.ts';
import { createWorktree } from '#src/worktree/createWorktree.ts';
import { prepareWorkOrderBranch } from '#src/worktree/prepareWorkOrderBranch.ts';
import { readBranchWorktree } from '#src/worktree/readBranchWorktree.ts';
import { readWorktreeRecord } from '#src/worktree/records/readWorktreeRecord.ts';
import { resolveWorktreePath } from '#src/worktree/resolveWorktreePath.ts';

interface Params {
	/** The checkout the command was launched from — `--cwd`, or the process directory. */
	cwd: string;
	/** The launching checkout's config, so a repository whose config is not yet committed still gets the isolation it asked for. */
	config: LightsoutConfig | undefined;
	flags: CommandContext['flags'];
	/** A plan address. The branch is its work order's, never the address. */
	name: string;
	onProgress?: (message: string) => void;
}

const noWorktreeRemedy = 'pass --no-worktree to plan in the launching checkout deliberately';

/**
 * Any owner's record is accepted, since every plan of a ticket shares one branch,
 * and none is re-stamped: the queue's resume and cleanup recognise their tree by
 * its own owner. A tree nothing claims is refused, because an occupied directory
 * is never evidence, and so is any tree a live run holds.
 */
const continueInTree = async ({ cwd, branch, treePath }: { cwd: string; branch: string; treePath: string }) => {
	const holder = await readLiveRunLock({ cwd: treePath });

	if (holder !== undefined) {
		return { error: `the worktree at ${treePath} cannot be planned in: run ${holder.runId} is using it right now — wait for it, or ${noWorktreeRemedy}` };
	}

	const record = await readWorktreeRecord({ cwd, branch });

	if (record !== undefined) {
		return { cwd: treePath, branch, isolated: true, created: false };
	}

	return { error: `the worktree at ${treePath} cannot be planned in: no ownership record claims it for this plan — ${noWorktreeRemedy}` };
};

/**
 * A re-cut reuses the recorded start point. `createWorktree` adopts a branch git
 * already knows whatever start point it is handed, which puts a later plan's tree
 * on the branch's current implementation. A branch only the remote holds starts
 * at the pushed commit, not at whatever this checkout stands on.
 */
const cutPlanTree = async ({
	cwd,
	config,
	branch,
	pushedStartPoint,
	treePath,
	onProgress,
}: {
	cwd: string;
	config: LightsoutConfig | undefined;
	branch: string;
	pushedStartPoint: string | undefined;
	treePath: string;
	onProgress?: (message: string) => void;
}) => {
	const recorded = await readWorktreeRecord({ cwd, branch });
	const startPoint = pushedStartPoint ?? recorded?.startPoint ?? (await readGitHeadCommit({ cwd }));

	if (startPoint === undefined) {
		return { error: `no worktree was made at ${treePath}: the launching checkout has no commit to plan from — ${noWorktreeRemedy}` };
	}

	// `worktree.setup` runs because this same tree becomes the implementation workspace.
	const created = await createWorktree({
		cwd,
		branch,
		startPoint,
		setup: config?.worktree?.setup,
		owner: WorktreeOwner.Plan,
		reuseExisting: false,
		onProgress,
	});

	return typeof created === 'string' ? { cwd: created, branch, isolated: true, created: true } : { error: `${created.error} — ${noWorktreeRemedy}` };
};

/**
 * The order is a requirement, for the reason `resolveRunWorkspace` gives: nothing
 * touches git when isolation is off.
 *
 * The branch is settled against the remote first because a later plan must be
 * researched against the implementation the branch already carries. A session
 * already standing in the tree is answered as it stands, whatever its record says.
 *
 * It never exits or prints; the command owns both.
 */
export const resolvePlanWorktree = async ({ cwd, config, flags, name, onProgress }: Params): Promise<PlanWorktree | { error: string }> => {
	const isolated = resolveWorktreeIsolation({ flags, configured: config?.plan?.worktree });

	if (typeof isolated !== 'boolean') {
		return isolated;
	}

	if (!isolated) {
		return { cwd, isolated: false, created: false };
	}

	const workOrderName = workOrderNameOf({ name });
	// The label names the work order to look up; the branch is whatever its
	// record stores, which under a prefixed template is a different string.
	const record = await readWorkOrderRecordFile({ workOrderFolder: await workOrderFolderDir({ cwd, name: workOrderName }) });

	if (record === undefined) {
		return {
			error: `no work order is named '${workOrderName}', so there is no branch to plan on — create one with \`lightsout work-order new\`, or ${noWorktreeRemedy}`,
		};
	}

	const branch = record.branch;
	const treePath = await resolveWorktreePath({ cwd, branch });

	if (await isSamePath({ path: cwd, otherPath: treePath })) {
		return { cwd: treePath, branch, isolated: true, created: false };
	}

	const prepared = await prepareWorkOrderBranch({ cwd, branch });

	if ('error' in prepared) {
		return prepared;
	}

	const holder = await readBranchWorktree({ cwd, branch });
	let worktree: PlanWorktree | { error: string };

	if (holder === undefined) {
		worktree = await cutPlanTree({ cwd, config, branch, pushedStartPoint: prepared.startPoint, treePath, onProgress });
	} else if (await isSamePath({ path: holder, otherPath: treePath })) {
		worktree = await continueInTree({ cwd, branch, treePath });
	} else {
		worktree = { error: `'${branch}' is already checked out at ${holder} — plan from ${holder}, or ${noWorktreeRemedy}` };
	}

	return worktree;
};
