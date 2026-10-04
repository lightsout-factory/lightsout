import { formatShortRunId } from '@lightsout/shared';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { isRunResumable } from '#src/runState/liveness/isRunResumable.ts';
import { getRunTitle } from '#src/views/common/getRunTitle.ts';
import type { FrozenWorklist } from '#src/views/common/types/FrozenWorklist.ts';

interface Params {
	manifest: RunManifest;
	/** Whether a live process stands behind the run, as `readRunLiveness` answered. */
	live: boolean;
	worklist?: FrozenWorklist;
}

/** Reads nothing itself, so listing every run stays cheap however long the history gets. */
export const buildRunListing = ({ manifest, live, worklist }: Params): RunListing => {
	return {
		runId: manifest.runId,
		shortId: formatShortRunId({ runId: manifest.runId }),
		pipeline: manifest.pipeline ?? PipelineKind.Implement,
		status: manifest.status,
		title: getRunTitle({ plan: manifest.plan, worklist }),
		plan: manifest.plan,
		planName: manifest.planName,
		createdAt: manifest.createdAt,
		updatedAt: manifest.updatedAt,
		live,
		packages: manifest.packages,
		stepsPassed: manifest.steps.filter((step) => step.status === RunStatus.Passed).length,
		stepCount: manifest.steps.length,
		changedFileCount: manifest.changedFiles.length,
		costUsd: manifest.usage?.costUsd,
		parentRunId: manifest.parentRunId,
		resumable: isRunResumable({ status: manifest.status, live }),
	};
};
