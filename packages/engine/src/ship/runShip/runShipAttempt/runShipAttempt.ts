import { readGitHeadCommit } from '#src/common/git/readGitHeadCommit.ts';
import type { PullRequestSummary } from '#src/common/types/PullRequestSummary.ts';
import type { ShipIntegration } from '#src/common/types/ShipIntegration.ts';
import type { ShipSettings } from '#src/common/types/ShipSettings.ts';
import type { ShipWorkOrderGuard } from '#src/common/types/ShipWorkOrderGuard.ts';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import type { ShipResult } from '#src/contracts/ship/ShipResult.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { appendCommandOutput } from '#src/ship/common/appendCommandOutput.ts';
import { mergePullRequest } from '#src/ship/forge/mergePullRequest.ts';
import { integrateDefaultBranch } from '#src/ship/integration/integrateDefaultBranch/integrateDefaultBranch.ts';
import type { ShippingProgressRecorder } from '#src/ship/progress/ShippingProgressRecorder.ts';
import { createBlockedAttempt } from '#src/ship/runShip/runShipAttempt/common/createBlockedAttempt.ts';
import type { ShipAttemptResult } from '#src/ship/runShip/runShipAttempt/common/types/ShipAttemptResult.ts';
import type { ShipStopFields } from '#src/ship/runShip/runShipAttempt/common/types/ShipStopFields.ts';
import { openPullRequest } from '#src/ship/runShip/runShipAttempt/openPullRequest.ts';
import { publishCandidate } from '#src/ship/runShip/runShipAttempt/publishCandidate.ts';
import { readCheckStop } from '#src/ship/runShip/runShipAttempt/readCheckStop.ts';
import { recordShipStep } from '#src/ship/runShip/runShipAttempt/recordShipStep.ts';

type ProgressSink = (message: string) => void;

interface Params {
	cwd: string;
	settings: ShipSettings;
	integration: ShipIntegration;
	/** The branch's ticket record's say over the merge, re-asked here immediately before it. */
	workOrderGuard: ShipWorkOrderGuard;
	branch: string;
	defaultBranch: string;
	/** The branch's ticket capture groups — `ticket` plus whatever else the pattern names. */
	ticket: Record<string, string>;
	/** The branch's own diff against the commit it was cut from, captured once by `runShip` and unchanged across attempts. */
	branchDiff: string;
	/** The previous attempt's failure evidence, when this attempt is meant to repair a demonstrated CI defect. */
	ciEvidence?: string;
	/** Records each step as it starts and finishes. Required, so no attempt can run without recording. */
	recorder: ShippingProgressRecorder;
	onProgress?: ProgressSink;
}

interface PrepareParams extends Omit<Params, 'ticket' | 'recorder' | 'workOrderGuard'> {
	ticketRef: string;
	stop: ShipStopFields;
}

const prepareCandidate = async ({ cwd, settings, integration, branch, defaultBranch, ticketRef, branchDiff, ciEvidence, stop, onProgress }: PrepareParams) => {
	const baselineCommit = await readGitHeadCommit({ cwd });

	if (baselineCommit === undefined) {
		return createBlockedAttempt({ stop, reason: ShipBlockReason.IntegrationUnavailable, detail: `git could not name the commit '${branch}' is standing on` });
	}

	const integrationFailure = await integrateDefaultBranch({
		cwd,
		integration,
		branch,
		defaultBranch,
		baselineCommit,
		preShip: settings.preShip,
		ciEvidence,
		branchDiff,
		ticketRef,
		onProgress,
	});

	if (integrationFailure !== undefined) {
		return createBlockedAttempt({ stop, reason: integrationFailure.reason, detail: integrationFailure.detail, failingChecks: integrationFailure.paths });
	}

	const candidate = await readGitHeadCommit({ cwd });

	return (
		candidate ?? createBlockedAttempt({ stop, reason: ShipBlockReason.IntegrationUnavailable, detail: 'git could not name the verified candidate commit' })
	);
};

/**
 * The ticket record is re-asked inside the merge step, after the checks went green: a plan added
 * while they ran takes the branch outside its approved ship request, and this is the last moment
 * that can still stop the merge.
 */
const mergeCandidate = async ({
	pullRequest,
	candidate,
	cwd,
	settings,
	workOrderGuard,
	stop,
	recorder,
}: {
	pullRequest: PullRequestSummary;
	candidate: string;
	cwd: string;
	settings: ShipSettings;
	workOrderGuard: ShipWorkOrderGuard;
	stop: ShipStopFields;
	recorder: ShippingProgressRecorder;
}) => {
	const mergeCommit = await recordShipStep({
		recorder,
		step: ShippingStepId.Merge,
		run: async () => {
			const unauthorized = await workOrderGuard.authorize({ cwd, branch: stop.branch });

			return unauthorized === undefined
				? await mergePullRequest({ prNumber: pullRequest.number, mergeMethod: settings.mergeMethod, expectedHead: candidate, cwd })
				: { unauthorized };
		},
		passed: (merged) => typeof merged === 'string',
	});

	if (typeof mergeCommit !== 'string') {
		if ('unauthorized' in mergeCommit) {
			return createBlockedAttempt({ stop, reason: ShipBlockReason.WorkOrderNotAuthorized, detail: mergeCommit.unauthorized });
		}

		const detail = appendCommandOutput({ sentence: `the forge refused to merge #${pullRequest.number}`, stderr: mergeCommit.stderr });

		return createBlockedAttempt({ stop, reason: ShipBlockReason.MergeRejected, detail, retryable: mergeCommit.staleBase === true });
	}

	return {
		result: {
			status: ShipStatus.Shipped,
			...stop,
			prNumber: pullRequest.number,
			prUrl: pullRequest.url,
			prTitle: pullRequest.title,
			mergeCommit,
			mergedAt: new Date().toISOString(),
			failingChecks: [],
		} satisfies ShipResult,
		retryable: false,
	};
};

/**
 * It writes no result and cleans nothing up: `runShip` may spend several attempts, and a result
 * per attempt would tell a tracker skill the ship ended twice. `retryable` is narrow because any
 * other failure would meet exactly the same wall on another attempt.
 */
export const runShipAttempt = async ({
	cwd,
	settings,
	integration,
	workOrderGuard,
	branch,
	defaultBranch,
	ticket,
	branchDiff,
	ciEvidence,
	recorder,
	onProgress,
}: Params): Promise<ShipAttemptResult> => {
	const ticketRef = ticket.ticket ?? branch;
	const stop: ShipStopFields = { branch, ticketRef };

	const candidate = await recordShipStep({
		recorder,
		step: ShippingStepId.Integrate,
		run: () => prepareCandidate({ cwd, settings, integration, branch, defaultBranch, ticketRef, branchDiff, ciEvidence, stop, onProgress }),
		passed: (prepared) => typeof prepared === 'string',
	});

	if (typeof candidate !== 'string') {
		return candidate;
	}

	const pushFailure = await recordShipStep({
		recorder,
		step: ShippingStepId.Push,
		run: () => publishCandidate({ branch, cwd, candidate }),
		passed: (failure) => failure === undefined,
	});

	if (pushFailure !== undefined) {
		const detail = appendCommandOutput({ sentence: `git could not push '${branch}' to origin`, stderr: pushFailure.stderr });

		return createBlockedAttempt({ stop, reason: ShipBlockReason.PushFailed, detail });
	}

	const pullRequest = await recordShipStep({
		recorder,
		step: ShippingStepId.PullRequest,
		run: () => openPullRequest({ branch, cwd, settings, ticket, onProgress }),
		passed: (opened) => !('stderr' in opened),
	});

	if ('stderr' in pullRequest) {
		const detail = appendCommandOutput({ sentence: `no pull request could be opened or read for '${branch}'`, stderr: pullRequest.stderr });

		return createBlockedAttempt({ stop, reason: ShipBlockReason.PullRequestUnavailable, detail });
	}

	const checkStop = await recordShipStep({
		recorder,
		step: ShippingStepId.Checks,
		run: () => readCheckStop({ prNumber: pullRequest.number, candidate, cwd, settings, stop, onProgress }),
		passed: (stopped) => stopped === undefined,
	});

	return checkStop ?? mergeCandidate({ pullRequest, candidate, cwd, settings, workOrderGuard, stop, recorder });
};
