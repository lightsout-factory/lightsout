import { StandardsSet } from '@lightsout/standards-contracts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { ResolvedStandards } from '#src/standards/ResolvedStandards.ts';
import { resolveStandardsChannels } from '#src/standards/resolveStandardsChannels.ts';
import { buildStandardsDocuments } from '#src/standardsLibraries/buildStandardsDocuments.ts';
import { resolveStandardsPacks } from '#src/standardsLibraries/resolveStandardsPacks.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
	/** Scoped packages whose dependencies decide the framework channels. Empty = base docs only. */
	packages: string[];
}

/**
 * Assembled from the rule folders themselves, so no pre-built copy exists to
 * drift from its prose.
 *
 * @throws {Error} When a declared standards pack cannot be loaded: a consumer that
 * declared standards and did not get them must not run.
 */
export const resolveStandards = async ({ cwd, config, packages }: Params): Promise<ResolvedStandards> => {
	const loaded = await resolveStandardsPacks({ cwd, config });
	const channels = await resolveStandardsChannels({ cwd, config, packages });
	const assembled = loaded.map((pack) => buildStandardsDocuments({ pack, channels, config }));

	const stack = ({ set }: { set: StandardsSet }) => {
		const texts = assembled.map((documents) => documents[set]).filter((text) => text !== undefined);

		return texts.length === 0 ? undefined : texts.join('\n\n');
	};

	return {
		standards: stack({ set: StandardsSet.Code }),
		testStandards: stack({ set: StandardsSet.Tests }),
		channels,
		configured: config['standards-channels'] !== undefined,
		requested: loaded.length > 0,
	};
};
