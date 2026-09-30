import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

interface Params {
	/** The repo's config, absent on a repo that has none. */
	config: LightsoutConfig | undefined;
}

/**
 * True when no package gets standards: the repo pack is off and
 * `package-standards-packs` names no package that would still get its own.
 */
export const selectsNoStandards = ({ config }: Params): boolean =>
	config?.['standards-pack'] === false && Object.keys(config['package-standards-packs'] ?? {}).length === 0;
