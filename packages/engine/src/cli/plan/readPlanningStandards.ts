import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { resolveStandardsChannels } from '#src/standards/resolveStandardsChannels.ts';
import { buildStandardsDocuments } from '#src/standardsLibraries/buildStandardsDocuments.ts';
import { resolveStandardsPacks } from '#src/standardsLibraries/resolveStandardsPacks.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig | undefined;
}

// Standards are supplemental for planning, so failing to load them is non-fatal.
// Only the code set: planning writes a plan, not tests.
export const readPlanningStandards = async ({ cwd, config }: Params): Promise<string | undefined> => {
	let standards: string | undefined;

	try {
		const channels = await resolveStandardsChannels({ cwd, config, packages: [] });
		const loaded = await resolveStandardsPacks({ cwd, config });
		const texts = loaded.map((pack) => buildStandardsDocuments({ pack, channels, config }).code).filter((text) => text !== undefined);

		standards = texts.length === 0 ? undefined : texts.join('\n\n');
	} catch (error) {
		console.log(dim(`standards not loaded (non-fatal): ${messageOf({ error })}`));
		standards = undefined;
	}

	return standards;
};
