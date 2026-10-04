import type { LeftBehindTicket } from '#src/common/types/LeftBehindTicket.ts';
import type { QueueSettings } from '#src/common/types/QueueSettings.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { settleReconciledWorktree } from '#src/queue/common/settleReconciledWorktree.ts';
import type { MergedParkedTree } from '#src/queue/common/types/MergedParkedTree.ts';
import { reconcileShippedTicket } from '#src/ticketLifecycle/reconcileShippedTicket/reconcileShippedTicket.ts';
import { setTicketLabel } from '#src/ticketTracker/setTicketLabel.ts';

interface Params {
	/** The main repository checkout. */
	cwd: string;
	config: LightsoutConfig;
	/** The process environment the tracker credentials are read from. Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	merged: MergedParkedTree[];
	onProgress?: (message: string) => void;
}

/**
 * Sequential because each iteration removes a worktree in the main checkout, and
 * main-checkout mutations must not overlap.
 *
 * The merge already happened, so every failure here becomes a sentence appended
 * to the reason rather than a failure.
 */
export const settleMergedTrees = async ({ cwd, config, env, settings, trackerSettings, merged, onProgress }: Params): Promise<LeftBehindTicket[]> => {
	const settled: LeftBehindTicket[] = [];

	for (const tree of merged) {
		const reconciliationFailure = await reconcileShippedTicket({ config, env, ticketRef: tree.ticket.identifier, onProgress });

		if (reconciliationFailure !== undefined) {
			onProgress?.(reconciliationFailure);
		}

		const heldWorktree = await settleReconciledWorktree({ cwd, worktreePath: tree.worktreePath, branch: tree.branch, onProgress });
		const cleared = await setTicketLabel({ settings: trackerSettings, ticketId: tree.ticket.id, label: settings.parkedLabel, present: false });

		if (cleared !== undefined) {
			onProgress?.(`${tree.ticket.identifier} · the parked label could not be cleared: ${cleared.error}`);
		}

		const reason = `its worktree at ${tree.worktreePath} held a branch already recorded merged, so the ticket was reconciled to done rather than resumed${heldWorktree ?? ''}${reconciliationFailure === undefined ? '' : ` — ${reconciliationFailure}`}`;

		onProgress?.(`${tree.ticket.identifier} · ${reason}`);
		settled.push({
			identifier: tree.ticket.identifier,
			title: tree.ticket.title,
			url: tree.ticket.url,
			reason,
			settled: true,
			...(reconciliationFailure === undefined ? {} : { reconciliationFailure }),
		});
	}

	return settled;
};
