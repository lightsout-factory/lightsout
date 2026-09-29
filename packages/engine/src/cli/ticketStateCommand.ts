import { getStringFlag } from '#src/cli/common/args/getStringFlag.ts';
import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import { getRequiredFlag } from '#src/cli/internal/common/args/getRequiredFlag.ts';
import { readConfig } from '#src/common/config/readConfig.ts';
import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import { TrackerStatusRole } from '#src/ticketLifecycle/common/constants/TrackerStatusRole.ts';
import { resolveLifecycleSettings } from '#src/ticketLifecycle/resolveLifecycleSettings.ts';
import { updateTicketLifecycle } from '#src/ticketLifecycle/updateTicketLifecycle.ts';
import { getTicketsByIdentifiers } from '#src/ticketTracker/getTicketsByIdentifiers.ts';
import { resolveTrackerSettings } from '#src/ticketTracker/resolveTrackerSettings.ts';

// `Done` is deliberately absent: see the command's doc comment.
const writableStatusRoles = [TrackerStatusRole.Ready, TrackerStatusRole.InProgress];

const parsePlanningStatus = ({ value }: { value: string }) => {
	const matched = Object.values(PlanningStatus).find((status) => status === value);

	return matched ?? { error: `unknown planning status '${value}' — expected one of ${Object.values(PlanningStatus).join(', ')}` };
};

const parseTrackerStatusRole = ({ value }: { value: string }) => {
	const matched = writableStatusRoles.find((role) => role === value);

	if (matched !== undefined) {
		return matched;
	}

	const refusal =
		value === TrackerStatusRole.Done
			? "'done' is not written by hand: a ticket reaches done only when a merge is positively confirmed, which the ship path writes from the merged pull request the forge reported"
			: `unknown tracker status '${value}'`;

	return { error: `${refusal} — expected one of ${writableStatusRoles.join(', ')}` };
};

/**
 * `--tracker-status` takes the engine's role rather than a repository's own
 * spelling, so one skill line works in every repository. It does not accept
 * `done`: tracker completion must follow a merged pull request the forge
 * reported, never a hand-written flag.
 *
 * `readConfig` rather than the optional reader: this needs a `ticket-tracker`
 * block, so a repository with no config is refused.
 */
export const ticketStateCommand = async ({ flags, cwd }: CommandContext): Promise<void> => {
	const ref = await getRequiredFlag({ flags, name: 'ref' });
	const planningStatusFlag = getStringFlag({ flags, name: 'planning-status' });
	const trackerStatusFlag = getStringFlag({ flags, name: 'tracker-status' });

	if (planningStatusFlag === undefined && trackerStatusFlag === undefined) {
		console.error('ticket-state needs at least one of --planning-status or --tracker-status');
		return exitCli({ code: 1 });
	}

	const planningStatus = planningStatusFlag === undefined ? undefined : parsePlanningStatus({ value: planningStatusFlag });

	if (typeof planningStatus === 'object') {
		console.error(planningStatus.error);
		return exitCli({ code: 1 });
	}

	const trackerStatus = trackerStatusFlag === undefined ? undefined : parseTrackerStatusRole({ value: trackerStatusFlag });

	if (typeof trackerStatus === 'object') {
		console.error(trackerStatus.error);
		return exitCli({ code: 1 });
	}

	const config = await readConfig({ cwd });
	const trackerSettings = resolveTrackerSettings({ config, env: process.env });

	if ('error' in trackerSettings) {
		console.error(trackerSettings.error);
		return exitCli({ code: 1 });
	}

	const lifecycle = resolveLifecycleSettings({ config });

	if ('error' in lifecycle) {
		console.error(lifecycle.error);
		return exitCli({ code: 1 });
	}

	const found = await getTicketsByIdentifiers({ settings: trackerSettings, identifiers: [ref] });

	if ('error' in found) {
		console.error(`${ref} could not be read from the tracker: ${found.error}`);
		return exitCli({ code: 1 });
	}

	const ticket = found[0];

	if (ticket === undefined) {
		console.error(`the tracker returned no ticket with the identifier ${ref}`);
		return exitCli({ code: 1 });
	}

	const failure = await updateTicketLifecycle({
		lifecycle,
		trackerSettings,
		ticketId: ticket.id,
		planningStatus,
		trackerStatus,
		currentStatus: ticket.status,
	});

	if (failure !== undefined) {
		console.error(`${ref} could not be written: ${failure.error}`);
		return exitCli({ code: 1 });
	}

	const written = [
		planningStatus === undefined ? undefined : `planning status '${lifecycle.planningStatusLabels[planningStatus]}'`,
		trackerStatus === undefined ? undefined : `tracker status '${lifecycle.statusNames[trackerStatus]}'`,
	].filter((part) => part !== undefined);

	console.log(`${ref}: ${written.join(' and ')}`);

	return exitCli({ code: 0 });
};
