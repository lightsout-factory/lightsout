import { restoreBrainstormFiles } from '#src/brainstorm/restore/restoreBrainstormFiles.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { restorePlanWorkspace } from '#src/plan/restore/restorePlanWorkspace.ts';
import { readWorkOrderWithTrackerTarget } from '#src/workOrder/internal/common/utils/readWorkOrderWithTrackerTarget.ts';
import { recordWorkOrderSyncState } from '#src/workOrder/internal/common/utils/recordWorkOrderSyncState.ts';

interface Params {
	/** The checkout the plan's own folder is written into. */
	cwd: string;
	/** The plan's address, `<ticket-branch>/<plan-id>`. */
	address: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	/**
	 * The checkout whose primary holds the work order's state and sync sidecar.
	 * Defaults to `cwd`, and differs only when a plan is restored into a
	 * worktree while the record stays where the command was launched from.
	 */
	recordCwd?: string;
	onProgress?: (message: string) => void;
}

/** So a later publish knows this machine is not behind. */
const recordMarker = async ({
	recordCwd,
	name,
	planId,
	markerSha256,
	onProgress,
}: {
	recordCwd: string;
	name: string;
	planId: string;
	markerSha256: string;
	onProgress?: (message: string) => void;
}) => {
	const recorded = await recordWorkOrderSyncState({
		workOrderFolder: await workOrderFolderDir({ cwd: recordCwd, name }),
		planMarkers: { [planId]: markerSha256 },
		failure: `plan ${planId} was restored, but this machine could not record which generation it took`,
	});

	if (recorded !== undefined) {
		onProgress?.(recorded.error);
	}
};

/**
 * A plan is complete without its notes, so a brainstorm that cannot be verified is reported and the
 * restored plan stands. A ticket carrying no generation for this plan is a plan never published, not
 * a failure. It does not pull the state: pulling here would read the tracker twice per restored plan.
 */
export const restoreWorkOrderPlan = async ({
	cwd,
	address,
	config,
	env,
	recordCwd,
	onProgress,
}: Params): Promise<{ restored: string[] } | { error: string }> => {
	const parsed = parsePlanAddress({ name: address });

	if (parsed === undefined) {
		return {
			error: `'${address}' is not a plan address — a plan of a ticket is named as '<ticket-branch>/<plan-id>', for example 'lo-140-multi/001-search-basics'`,
		};
	}

	const { workOrderName: name, planId } = parsed;
	const opened = await readWorkOrderWithTrackerTarget({ cwd: recordCwd ?? cwd, name, config, env });

	if ('error' in opened) {
		return opened;
	}

	const { target } = opened;

	if ('localOnly' in target) {
		return { error: `plan ${planId} cannot be restored: ${target.localOnly}` };
	}

	const plan = await restorePlanWorkspace({ cwd, name: address, identifier: target.ticketRef, settings: target.settings, titlePrefix: planId });

	if (plan.error !== undefined) {
		return { error: plan.error };
	}

	if (plan.restored.length === 0) {
		return { restored: [] };
	}

	const brainstorm = await restoreBrainstormFiles({ cwd, name: address, identifier: target.ticketRef, settings: target.settings, titlePrefix: planId });

	if (brainstorm.error !== undefined) {
		onProgress?.(`plan ${planId} was restored, but its brainstorm generation was not: ${brainstorm.error}`);
	}

	if (plan.markerSha256 !== undefined) {
		await recordMarker({ recordCwd: recordCwd ?? cwd, name, planId, markerSha256: plan.markerSha256, onProgress });
	}

	return { restored: [...plan.restored, ...brainstorm.restored].sort() };
};
