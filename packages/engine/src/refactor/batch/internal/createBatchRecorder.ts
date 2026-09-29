import { collectBatchChanges } from '#src/common/utils/collectBatchChanges.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';
import { buildBatchReport } from '#src/refactor/batch/buildBatchReport.ts';
import type { BatchRecorder } from '#src/refactor/batch/internal/common/types/BatchRecorder.ts';
import { BatchStopKind } from '#src/refactor/internal/common/constants/BatchStopKind.ts';
import type { BatchStop } from '#src/refactor/internal/common/types/BatchStop.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
	/** Excluded from the git-truth merge. */
	attributedFiles: string[];
}

export const createBatchRecorder = ({ cwd, config, attributedFiles }: Params): BatchRecorder => {
	const rationale: string[] = [];
	const reportedFiles = new Set<string>();
	const advisoryOutcomes = new Map<string, AdvisoryOutcome>();

	const reportOf = ({ outcome, remainingSiteKeys }: { outcome: BatchOutcome; remainingSiteKeys: string[] }) =>
		buildBatchReport({ outcome, remainingSiteKeys, rationale, advisoryOutcomes: [...advisoryOutcomes.values()] });

	const changedFiles = () => collectBatchChanges({ cwd, config, reportedFiles, attributedFiles });

	/** Every classified end of the batch goes through here, so no branch can report an outcome without the files it changed. */
	const finish = async ({ outcome, remainingSiteKeys }: { outcome: BatchOutcome; remainingSiteKeys: string[] }): Promise<BatchStop> => ({
		kind: BatchStopKind.Done,
		report: reportOf({ outcome, remainingSiteKeys }),
		changedFiles: await changedFiles(),
	});

	return { rationale, reportedFiles, advisoryOutcomes, reportOf, changedFiles, finish };
};
