import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { ShipMergeMethod } from '#src/contracts/ship/ShipMergeMethod.ts';
import type { ShipSettings } from '#src/ship/common/types/ShipSettings.ts';

interface Params {
	config: LightsoutConfig;
}

const compilePattern = ({ source }: { source: string }) => {
	try {
		return new RegExp(source);
	} catch {
		return undefined;
	}
};

/**
 * A pattern that is not a valid regular expression, or captures no `ticket`
 * group, makes every branch unshippable, so it is refused at startup. Callers
 * report a usage error rather than a result file, because no run happened.
 */
export const resolveShipSettings = ({ config }: Params): ShipSettings | undefined => {
	const ship = config.ship;
	const ticketPattern = compilePattern({ source: ship?.['ticket-pattern'] ?? String.raw`^(?<ticket>[a-z]+-\d+)` });

	if (ticketPattern === undefined || !ticketPattern.source.includes('(?<ticket>')) {
		return undefined;
	}

	return {
		ticketPattern,
		pullRequestBody: ship?.['pr-body'] ?? '{ticket}',
		mergeMethod: ship?.['merge-method'] ?? ShipMergeMethod.Merge,
		afterImplement: ship?.['after-implement'] ?? false,
		preShip: ship?.['pre-ship'],
		allowNoCi: ship?.['allow-no-ci'] ?? false,
	};
};
