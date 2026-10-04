import { dim } from '#src/cli/internal/common/terminal/dim.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { resolveStandards } from '#src/standards/resolveStandards.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig | undefined;
}

// Standards are supplemental for planning, so failing to load them is non-fatal.
// Only the code set: planning writes a plan, not tests.
export const readPlanningStandards = async ({ cwd, config }: Params): Promise<string | undefined> => {
	let standards: string | undefined;

	try {
		standards = (await resolveStandards({ cwd, config })).standards;
	} catch (error) {
		console.log(dim(`standards not loaded (non-fatal): ${messageOf({ error })}`));
		standards = undefined;
	}

	return standards;
};
