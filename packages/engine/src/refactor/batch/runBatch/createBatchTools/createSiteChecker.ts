import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { matchRemainingFindings } from '#src/refactor/batch/runBatch/common/matchRemainingFindings.ts';
import type { BatchSiteChecker } from '#src/refactor/batch/runBatch/common/types/BatchSiteChecker.ts';
import { runStandardsCheck } from '#src/standardsCheck/runStandardsCheck/runStandardsCheck.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
	/** Check scope of the run's worklist. */
	checkPath?: string;
	/** Must match the worklist's mode. */
	checkAll: boolean;
}

/**
 * Bound to the worklist's scope and mode: a re-check at a different scope would
 * read a site that fell outside it as one the batch resolved.
 */
export const createSiteChecker = ({ cwd, config, checkPath, checkAll }: Params): BatchSiteChecker => {
	const checkLive = () => runStandardsCheck({ cwd, config, path: checkPath, all: checkAll, persist: false });

	const remainingSiteKeys = async ({ frozen }: { frozen: StandardsFinding[] }) => {
		const { findings } = await checkLive();

		return matchRemainingFindings({ frozen, live: findings });
	};

	return { checkLive, remainingSiteKeys };
};
