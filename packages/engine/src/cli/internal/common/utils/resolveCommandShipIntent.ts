import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { contradictoryShipFlagsMessage } from '#src/cli/internal/common/constants/contradictoryShipFlagsMessage.ts';
import type { ShipIntent } from '#src/common/types/ShipIntent.ts';
import type { ShipRequestTerms } from '#src/common/types/ShipRequestTerms.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { resolveShipIntent } from '#src/ship/resolveShipIntent.ts';

interface Params {
	config: LightsoutConfig;
	flags: CommandContext['flags'];
	/** The process environment, read for the queue's own suppression variable. Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
	/** The ticket's own terms for this run, when the plan being built belongs to a ticket record. */
	shipRequest?: ShipRequestTerms;
}

/**
 * Resolved before the run starts so the manifest records whether it will ship
 * and the progress view can draw a ship row. Undefined means the contradiction
 * is already reported on stderr.
 */
export const resolveCommandShipIntent = ({ config, flags, env, shipRequest }: Params): ShipIntent | undefined => {
	const intent = resolveShipIntent({
		config,
		shipFlag: flags.get('ship') === true,
		noShipFlag: flags.get('no-ship') === true,
		env,
		shipRequest,
	});

	if (intent.contradictory) {
		console.error(contradictoryShipFlagsMessage);

		return undefined;
	}

	return intent;
};
