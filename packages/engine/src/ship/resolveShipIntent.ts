import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { ShipIntent } from '#src/ship/common/types/ShipIntent.ts';
import type { ShipRequestTerms } from '#src/ship/common/types/ShipRequestTerms.ts';
import { resolveShipSettings } from '#src/ship/resolveShipSettings.ts';

interface Params {
	config: LightsoutConfig;
	shipFlag: boolean;
	/** Beats the config's `after-implement`. */
	noShipFlag: boolean;
	/** Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
	/** Present only when the branch's ticket record, not the flags, decides the shipping. */
	shipRequest?: ShipRequestTerms;
}

/**
 * Decided before the run starts, so the manifest's stamp and the eventual exit
 * agree by construction. `LIGHTSOUT_NO_SHIP` wins silently: the queue sets it for
 * its worker sessions, whose branches only the drain's own serial merge may ship.
 *
 * `willShip` can be true while `settings` is undefined (`--ship` against an
 * unusable ticket pattern), so the progress table shows the row and the exit
 * path still refuses with a message naming the key.
 *
 * A `shipRequest` replaces `--ship` and `ship.after-implement`: a multiple-plan
 * work order ships only when the human's explicit request is satisfied.
 */
export const resolveShipIntent = ({ config, shipFlag, noShipFlag, env, shipRequest }: Params): ShipIntent => {
	const settings = resolveShipSettings({ config });
	const contradictory = shipFlag && noShipFlag;
	const suppressed = noShipFlag || (env.LIGHTSOUT_NO_SHIP ?? '') !== '';
	const asked = shipRequest === undefined ? shipFlag || settings?.afterImplement === true : shipRequest.blocker === undefined;
	const stopped = contradictory || suppressed;

	return {
		contradictory,
		willShip: !stopped && asked,
		settings,
		// The field exists only where a ticket record had a say at all, and carries a
		// sentence only where that say is what held the run back.
		...(shipRequest === undefined ? {} : { shipRequestBlocker: stopped ? undefined : shipRequest.blocker }),
	};
};
