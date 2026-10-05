import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import { TrackerStatusRole } from '#src/common/constants/TrackerStatusRole.ts';
import { describeGateHold } from '#src/common/gates/describeGateHold.ts';
import { isTicketGateHeld } from '#src/common/gates/isTicketGateHeld.ts';
import type { LifecycleSettings } from '#src/common/types/LifecycleSettings.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { syncGateHolds } from '#src/gates/gateHolds/syncGateHolds/syncGateHolds.ts';
import { resolveLifecycleSettings } from '#src/ticketLifecycle/resolveLifecycleSettings/resolveLifecycleSettings.ts';
import { updateTicketLifecycle } from '#src/ticketLifecycle/updateTicketLifecycle.ts';
import { getTicketsByIdentifiers } from '#src/ticketTracker/getTicketsByIdentifiers.ts';
import { resolveTrackerSettings } from '#src/ticketTracker/resolveTrackerSettings.ts';
import { readWorkOrderTicketRef } from '#src/workOrder/readWorkOrderTicketRef.ts';

interface Params {
	/** The checkout source work is about to begin in. */
	cwd: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	/** The reference `--ref` carried, when the command takes one. Absent means the branch is read instead. */
	ticketRef?: string;
	onProgress?: (message: string) => void;
}

/**
 * The two terminal shaping states are preserved, because the case that matters
 * is a human `planning-not-needed` classification that must never be rewritten
 * as shaped work. Everything else — `planning-ready-auto-plan`, either
 * `planning-needs-*` value, no label at all, or more than one — becomes
 * `planning-complete`: a queued auto-plan ticket is still
 * `planning-ready-auto-plan` when its nested implementation starts, and it must
 * not enter In Progress claiming shaping is still owed.
 */
const toPreImplementationPlanningStatus = ({ labels, lifecycle }: { labels: string[]; lifecycle: LifecycleSettings }) => {
	const byLabel = new Map(Object.values(PlanningStatus).map((status) => [lifecycle.planningStatusLabels[status], status]));
	const carried = labels.flatMap((label) => {
		const status = byLabel.get(label);

		return status === undefined ? [] : [status];
	});
	const only = carried.length === 1 ? carried[0] : undefined;

	return only === PlanningStatus.Complete || only === PlanningStatus.NotNeeded ? only : PlanningStatus.Complete;
};

/**
 * A markdown instruction cannot make a write required, so the engine performs
 * it before an agent touches any source, and a write that cannot be made stops
 * the run rather than letting two entry points disagree about who owns the
 * branch.
 *
 * A held ticket is refused after it is fetched and before any lifecycle write,
 * so it is never moved to In Progress and then turned away. The holds are
 * reconciled rather than read raw, so a ticket whose label a human just
 * removed starts on the first try.
 *
 * A ticket already at the done status keeps it: re-running implement on a
 * shipped branch is an ordinary fix-up, and moving it back to In Progress would
 * make merged work look unshipped.
 *
 * @returns undefined when the run may start, or the one sentence saying why it may not
 */
export const requireImplementLifecycle = async ({ cwd, config, env, ticketRef, onProgress }: Params): Promise<string | undefined> => {
	if (config['ticket-tracker'] === undefined) {
		return undefined;
	}

	const reference = ticketRef ?? (await readWorkOrderTicketRef({ cwd }));

	if (reference === undefined) {
		return undefined;
	}

	const trackerSettings = resolveTrackerSettings({ config, env });

	if ('error' in trackerSettings) {
		return trackerSettings.error;
	}

	const lifecycle = resolveLifecycleSettings({ config });

	if ('error' in lifecycle) {
		return lifecycle.error;
	}

	const found = await getTicketsByIdentifiers({ settings: trackerSettings, identifiers: [reference] });

	if ('error' in found) {
		return found.error;
	}

	const ticket = found[0];

	if (ticket === undefined) {
		return `no ticket ${reference} was found on the tracker, and \`lightsout implement\` records In Progress before it changes any source`;
	}

	const holds = await syncGateHolds({ cwd, settings: trackerSettings, onProgress });

	if (isTicketGateHeld({ holds, identifier: reference, labels: ticket.labels })) {
		return describeGateHold({ hold: holds[reference.toLowerCase()], identifier: reference });
	}

	const shipped = ticket.status === lifecycle.statusNames[TrackerStatusRole.Done];
	const planningStatus = toPreImplementationPlanningStatus({ labels: ticket.labels, lifecycle });
	const inProgressStatus = lifecycle.statusNames[TrackerStatusRole.InProgress];
	const failure = await updateTicketLifecycle({
		lifecycle,
		trackerSettings,
		ticketId: ticket.id,
		planningStatus,
		trackerStatus: shipped ? undefined : TrackerStatusRole.InProgress,
		currentStatus: ticket.status,
	});

	if (failure !== undefined) {
		return `${reference} could not be moved to '${inProgressStatus}' with planning status '${lifecycle.planningStatusLabels[planningStatus]}': ${failure.error} — implement records the ticket's state before it changes any source, so the run stops here`;
	}

	onProgress?.(
		shipped
			? `${reference} · recorded '${lifecycle.planningStatusLabels[planningStatus]}' and left it at '${ticket.status}', because a shipped ticket is not moved back to '${inProgressStatus}'`
			: `${reference} · recorded '${lifecycle.planningStatusLabels[planningStatus]}' and moved to '${inProgressStatus}'`,
	);

	return undefined;
};
