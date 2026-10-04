import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import { ParkedTreeBucket } from '#src/queue/worktrees/internal/common/constants/ParkedTreeBucket.ts';
import type { ParkedTree } from '#src/queue/worktrees/internal/common/types/ParkedTree.ts';
import { classifyTree } from '#src/queue/worktrees/internal/common/utils/classifyTree.ts';
import { setTicketLabel } from '#src/ticketTracker/setTicketLabel.ts';

interface Params {
	/** The main repository checkout. */
	cwd: string;
	tree: ParkedTree;
	ticket: TicketSummary;
	defaultBranch: string;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	onProgress?: (message: string) => void;
}

/**
 * Only a tree headed back to a worker has its parked label cleared. A label the tracker refuses
 * to clear is reported rather than fatal: the tree is drainable either way.
 */
export const settleUnmergedTree = async ({
	cwd,
	tree,
	ticket,
	defaultBranch,
	settings,
	trackerSettings,
	onProgress,
}: Params): Promise<WorkOrderRunOutcome | undefined> => {
	const bucket = await classifyTree({ cwd, tree, defaultBranch, onProgress });

	if (bucket === ParkedTreeBucket.Drain) {
		const cleared = await setTicketLabel({ settings: trackerSettings, ticketId: ticket.id, label: settings.parkedLabel, present: false });

		if (cleared !== undefined) {
			onProgress?.(`${tree.identifier} · the parked label could not be cleared: ${cleared.error}`);
		}

		return undefined;
	}

	return {
		ticket,
		name: tree.name,
		branch: tree.branch,
		worktreePath: tree.path,
		ready: bucket === ParkedTreeBucket.Ship,
		error: bucket === ParkedTreeBucket.Ship ? undefined : `git could not read the worktree at ${tree.path}`,
	};
};
