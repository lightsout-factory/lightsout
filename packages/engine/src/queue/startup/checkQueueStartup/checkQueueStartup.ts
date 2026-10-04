import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import { QueueWorker } from '#src/common/constants/QueueWorker.ts';
import { TrackerStatusRole } from '#src/common/constants/TrackerStatusRole.ts';
import { readGitDefaultBranch } from '#src/common/git/readGitDefaultBranch.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import type { QueueSettings } from '#src/common/types/QueueSettings.ts';
import type { ShipSettings } from '#src/common/types/ShipSettings.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import { checkPlanningStatusLabels } from '#src/queue/startup/checkQueueStartup/checkPlanningStatusLabels.ts';
import { renderWorkOrderBranch } from '#src/queue/startup/checkQueueStartup/renderWorkOrderBranch.ts';
import { matchesTicketPattern } from '#src/ship/matchesTicketPattern.ts';

interface Params {
	cwd: string;
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	shipSettings: ShipSettings;
}

/**
 * The configuration refusals come first, because a configuration that cannot
 * work should cost nothing to discover. A branch template the ticket pattern
 * cannot read would make every resumed ticket's identifier underivable.
 */
// Annotated because inference would widen each branch with the other's absent
// key, and `'error' in started` could no longer narrow the union at the call site.
export const checkQueueStartup = async ({ cwd, settings, trackerSettings, shipSettings }: Params): Promise<QueueFailure | { defaultBranch: string }> => {
	const readyStatus = settings.lifecycle.statusNames[TrackerStatusRole.Ready];

	// Both direct pairs need exact equality with the ready status, so a ready
	// status the eligible query never asks for makes that work silently
	// unrunnable and reports an empty backlog instead of a broken config.
	if (!settings.lifecycle.eligibleStatuses.includes(readyStatus)) {
		return {
			error: `\`queue.ready-status\` is '${readyStatus}', which \`queue.eligible-statuses\` does not list — no ticket waiting to be implemented would ever be picked up`,
		};
	}

	const labelled = await checkPlanningStatusLabels({ settings, trackerSettings });

	if (labelled !== undefined) {
		return labelled;
	}

	// The sample is shaped from the configured tracker prefix, so the check exercises
	// a branch name shaped like the repo's real ones — a hardcoded key would
	// false-alarm on every `ship.ticket-pattern` scoped to its own tracker project or team.
	const sample: TicketSummary = {
		id: 'sample',
		identifier: `${trackerSettings.ticketPrefix}-1`,
		title: 'sample',
		url: '',
		description: '',
		priority: 0,
		createdAt: '',
		labels: [],
		planningStatus: PlanningStatus.NotNeeded,
		worker: QueueWorker.Direct,
		status: readyStatus,
		finished: false,
		unfinishedBlockers: [],
	};
	const rendered = renderWorkOrderBranch({ ticket: sample, template: settings.branchTemplate });

	if (!matchesTicketPattern({ branch: rendered, ticketPattern: shipSettings.ticketPattern })) {
		return {
			error: `\`queue.branch-template\` renders '${rendered}', which \`ship.ticket-pattern\` does not match — every queued branch would be unshippable`,
		};
	}

	const defaultBranch = await readGitDefaultBranch({ cwd });

	if (defaultBranch === undefined) {
		return { error: 'the queue needs a default branch: `origin/HEAD` is unset — run `git remote set-head origin --auto`' };
	}

	// One fetch for the whole drain: every worktree creation builds on it, and
	// concurrent fetches in the main checkout add nothing but contention.
	await runCommand({ command: 'git fetch origin', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return { defaultBranch };
};
