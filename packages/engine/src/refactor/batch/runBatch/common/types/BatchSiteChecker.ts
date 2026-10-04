import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck/runStandardsCheck.ts';

/** See {@link createSiteChecker} for why the two travel together. */
export interface BatchSiteChecker {
	/** Does not persist a report. */
	checkLive: () => ReturnType<typeof runStandardsCheck>;
	remainingSiteKeys: (params: { frozen: StandardsFinding[] }) => Promise<string[]>;
}
