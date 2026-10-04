import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { findWorkOrderForBranch } from '#src/common/workspace/findWorkOrderForBranch.ts';
import { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import type { GateHolds } from '#src/gates/gateHolds/common/types/GateHolds.ts';
import { describeGateHold } from '#src/gates/gateHolds/common/utils/describeGateHold.ts';
import { isTicketGateHeld } from '#src/gates/gateHolds/common/utils/isTicketGateHeld.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { ParkedWork } from '#src/queue/internal/common/types/ParkedWork.ts';
import { establishBranchMerge } from '#src/queue/internal/common/utils/establishBranchMerge.ts';
import { toPlanningSummaries } from '#src/queue/internal/common/utils/toPlanningSummaries.ts';
import type { ParkedTree } from '#src/queue/worktrees/internal/common/types/ParkedTree.ts';
import { settleUnmergedTree } from '#src/queue/worktrees/internal/common/utils/settleUnmergedTree.ts';
import { getTicketsByIdentifiers } from '#src/ticketTracker/getTicketsByIdentifiers.ts';
import { readWorktreeRecord } from '#src/worktree/records/readWorktreeRecord.ts';
import { resolveWorktreesRoot } from '#src/worktree/resolveWorktreesRoot.ts';

interface Params {
	/** The main repository checkout. */
	cwd: string;
	defaultBranch: string;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	/** The holds this drain reconciled before the scan, so a held tree is left exactly where it is. */
	holds: GateHolds;
	onProgress?: (message: string) => void;
}

/**
 * Git answers filesystem-resolved paths, which differ behind a symlink; re-rooting keeps every
 * path the queue prints, hands to a worker and removes in the form `createWorktree` builds.
 */
const toQueuePath = ({ path, root, realRoot }: { path: string; root: string; realRoot: string }) => {
	for (const prefix of [root, realRoot]) {
		if (path.startsWith(`${prefix}/`)) {
			return join(root, path.slice(prefix.length + 1));
		}
	}

	return undefined;
};

/**
 * Read from git rather than the directory listing: a slash-bearing branch template nests
 * directories, so an entry name is not a branch name. The work order comes from the record that
 * stores the branch, never from the branch name.
 */
const listQueueWorktrees = async ({ cwd, onProgress }: { cwd: string; onProgress?: (message: string) => void }) => {
	const listed = await runCommand({ command: 'git worktree list --porcelain', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);
	const root = await resolveWorktreesRoot({ cwd });
	const realRoot = await realpath(root).catch(() => root);
	const trees: ParkedTree[] = [];

	for (const block of (listed?.exitCode === 0 ? listed.stdout : '').split('\n\n')) {
		const reported = /^worktree (.+)$/m.exec(block)?.[1];
		const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1];
		const path = reported === undefined ? undefined : toQueuePath({ path: reported, root, realRoot });

		if (path === undefined || branch === undefined) {
			continue;
		}

		const listing = await findWorkOrderForBranch({ cwd, branch });

		if (listing === undefined) {
			// A tree someone made by hand, or one whose work order was removed.
			// Either way no work order claims it, so it is not ours to touch.
			onProgress?.(`leaving ${path} alone — no work order's record stores its branch ${branch}`);
			continue;
		}

		const identifier = listing.record.ticketRef;

		if (identifier === undefined) {
			// The queue only ever runs tracker work, and a work order named from
			// words alone belongs to no ticket for it to reconcile against.
			onProgress?.(`leaving ${path} alone — its work order ${listing.name} belongs to no ticket`);
			continue;
		}

		const record = await readWorktreeRecord({ cwd, branch });

		if (record !== undefined && record.owner !== WorktreeOwner.Queue) {
			// A tree a standalone run made and may still be building in. A tree with no record at all
			// predates ownership records and is still the queue's to resume.
			onProgress?.(`leaving ${path} alone — it belongs to a '${record.owner}' run rather than the queue`);
			continue;
		}

		trees.push({ path, branch, identifier, name: listing.name });
	}

	return trees;
};

/**
 * A removed planning-status label, or one changed back to a shaping state, is the user
 * withdrawing the automation. A gate hold is asked before the merge check and before the drain
 * that would clear the parked label, so nothing about a held tree is settled.
 */
const describeLeftBehind = ({
	tree,
	matched,
	runnable,
	settings,
	holds,
}: {
	tree: ParkedTree;
	matched: TicketSummary[];
	runnable: TicketSummary[];
	settings: QueueSettings;
	holds: GateHolds;
}) => {
	let reason: string | undefined;

	if (matched.length === 0) {
		reason = `its worktree at ${tree.path} is parked, but the ticket carries no planning status label any more`;
	} else if (runnable.length === 0) {
		const carried = matched.map((ticket) => `'${settings.lifecycle.planningStatusLabels[ticket.planningStatus]}'`).join(' and ');

		reason = `its worktree at ${tree.path} is parked, but the ticket now carries ${carried}, which the queue never resumes`;
	} else if (isTicketGateHeld({ holds, identifier: tree.identifier, labels: runnable[0].labels })) {
		reason = describeGateHold({ hold: holds[tree.identifier.toLowerCase()], identifier: tree.identifier });
	}

	return reason;
};

/**
 * Tickets are fetched by identifier with no status filter, because a ticket moved to In Progress
 * at pickup is invisible to the eligible list. A branch someone merged by hand looks exactly like
 * a clean tree carrying commits, so merge is established before anything ships. A finished ticket
 * is never resumed, which would write it back to In Progress, and its unmerged worktree is left
 * in place because it may hold work no one has seen.
 */
export const scanParkedWorktrees = async ({ cwd, defaultBranch, settings, trackerSettings, holds, onProgress }: Params): Promise<ParkedWork | QueueFailure> => {
	const trees = await listQueueWorktrees({ cwd, onProgress });

	if (trees.length === 0) {
		return { resumed: [], outcomes: [], leftBehind: [], merged: [] };
	}

	const tickets = await getTicketsByIdentifiers({ settings: trackerSettings, identifiers: trees.map((tree) => tree.identifier) });

	if ('error' in tickets) {
		return tickets;
	}

	// Resumed: the worktree on disk is already the evidence the queue selected
	// this ticket, so the status half of the pair has been answered — a parked
	// ticket sits at the in-progress status by construction.
	const summaries = tickets.flatMap((ticket) => toPlanningSummaries({ ticket, lifecycle: settings.lifecycle, resumed: true }));
	const parked: ParkedWork = { resumed: [], outcomes: [], leftBehind: [], merged: [] };

	for (const tree of trees) {
		const matched = summaries.filter((ticket) => ticket.identifier.toLowerCase() === tree.identifier.toLowerCase());
		const runnable = matched.filter((ticket) => ticket.worker !== undefined);
		const left = describeLeftBehind({ tree, matched, runnable, settings, holds });

		if (left !== undefined) {
			// The tracker ticket rather than a summary: one that lost every
			// planning-status label has no summary but is still returned.
			const tracked = tickets.find((candidate) => candidate.identifier.toLowerCase() === tree.identifier.toLowerCase());

			onProgress?.(`${tree.identifier} · ${left}`);
			parked.leftBehind.push({ identifier: tree.identifier, ...(tracked === undefined ? {} : { title: tracked.title, url: tracked.url }), reason: left });
			continue;
		}

		const ticket = runnable[0];
		const evidence = await establishBranchMerge({ cwd, branch: tree.branch, onProgress });

		if (evidence !== undefined) {
			const established =
				evidence.pullRequest === undefined ? 'its branch is recorded merged' : `its branch already has a merged pull request #${evidence.pullRequest.number}`;

			onProgress?.(`${tree.identifier} · ${established}, so it is reconciled rather than resumed`);
			parked.merged.push({ worktreePath: tree.path, branch: tree.branch, ticket });
			continue;
		}

		if (ticket.finished) {
			const reason = `its worktree at ${tree.path} is parked, but the tracker files the ticket as finished while its branch is not merged, so the worktree was left in place — it may hold work nobody has merged`;

			onProgress?.(`${tree.identifier} · ${reason}`);
			parked.leftBehind.push({ identifier: tree.identifier, title: ticket.title, url: ticket.url, reason });
			continue;
		}

		const outcome = await settleUnmergedTree({ cwd, tree, ticket, defaultBranch, settings, trackerSettings, onProgress });

		if (outcome === undefined) {
			parked.resumed.push(...runnable);
		} else {
			parked.outcomes.push(outcome);
		}
	}

	return parked;
};
