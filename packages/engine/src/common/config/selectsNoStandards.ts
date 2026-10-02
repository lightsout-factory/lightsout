import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';

interface Params {
	/** The repo's config, absent on a repo that has none. */
	config: LightsoutConfig | undefined;
}

/**
 * True when no package gets standards. They are opt-in: the repo names no
 * `standards-pack`, or sets it `false`, and `package-standards-packs` names no
 * package that would still get its own.
 */
export const selectsNoStandards = ({ config }: Params): boolean => {
	const repo = config?.['standards-pack'];

	return (repo === undefined || repo === false) && Object.keys(config?.['package-standards-packs'] ?? {}).length === 0;
};
