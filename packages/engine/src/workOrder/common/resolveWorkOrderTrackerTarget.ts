import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { resolveTrackerSettings } from '#src/ticketTracker/resolveTrackerSettings.ts';
import type { TicketTrackerTarget } from '#src/workOrder/common/types/TicketTrackerTarget.ts';

interface Params {
	config: LightsoutConfig;
	/** Passed rather than read, so a test never mutates `process.env`. */
	env: NodeJS.ProcessEnv;
	workOrderName: string;
	/** Undefined for a work order that belongs to no ticket. */
	ticketRef: string | undefined;
}

/**
 * `localOnly` means there is nothing to publish to and never was. `error` means a
 * configured tracker could not be used, which must never be skipped: a published
 * record could then move without this machine noticing.
 */
export const resolveWorkOrderTrackerTarget = ({
	config,
	env,
	workOrderName,
	ticketRef,
}: Params): TicketTrackerTarget | { localOnly: string } | { error: string } => {
	if (config['ticket-tracker'] === undefined) {
		return {
			localOnly: `the work order state for '${workOrderName}' is local only: lightsout.config.json has no \`ticket-tracker\` block naming a provider and its credentials`,
		};
	}

	if (ticketRef === undefined) {
		return { localOnly: `the work order state for '${workOrderName}' is local only: its record carries no ticket reference, so it belongs to no ticket` };
	}

	const settings = resolveTrackerSettings({ config, env });

	return 'error' in settings ? settings : { settings, ticketRef };
};
