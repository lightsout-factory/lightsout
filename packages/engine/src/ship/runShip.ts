import { maxCheapFixRetries } from '#src/common/constants/maxCheapFixRetries.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import type { ShipResult } from '#src/contracts/ship/ShipResult.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import type { ShipIntegration } from '#src/ship/common/types/ShipIntegration.ts';
import type { ShipSettings } from '#src/ship/common/types/ShipSettings.ts';
import type { ShipWorkOrderGuard } from '#src/ship/common/types/ShipWorkOrderGuard.ts';
import { checkShipPreconditions } from '#src/ship/internal/checkShipPreconditions.ts';
import { runGit } from '#src/ship/internal/common/utils/runGit.ts';
import { runShipAttempt } from '#src/ship/internal/runShipAttempt.ts';
import { syncDefaultBranch } from '#src/ship/internal/syncDefaultBranch.ts';
import { writeShipResult } from '#src/ship/internal/writeShipResult.ts';
import { ShippingProgressRecorder } from '#src/ship/progress/ShippingProgressRecorder.ts';

type ProgressSink = (message: string) => void;

interface Params {
	cwd: string;
	/** Validating the config is the caller's job, so no step here throws. */
	settings: ShipSettings;
	/** Required, so no shipping path can be added without the safety contract. */
	integration: ShipIntegration;
	/** Required, so no shipping path can be added without asking the ticket first. */
	workOrderGuard: ShipWorkOrderGuard;
	onProgress?: ProgressSink;
}

/** The one way out of this file, so no exit path can forget to write a result. */
const record = async ({ cwd, result, onProgress }: { cwd: string; result: ShipResult; onProgress?: ProgressSink }) => {
	const resultPath = await writeShipResult({ cwd, result });

	if (resultPath !== undefined) {
		onProgress?.(`ship result: ${resultPath}`);
	}

	return result;
};

const stopShip = ({
	cwd,
	onProgress,
	failingChecks = [],
	...block
}: {
	cwd: string;
	onProgress?: ProgressSink;
	reason: ShipBlockReason;
	detail: string;
	branch?: string;
	ticketRef?: string;
	failingChecks?: string[];
}) => {
	return record({ cwd, onProgress, result: { status: ShipStatus.Blocked, failingChecks, ...block } });
};

/**
 * Read once, from the starting HEAD: a diff re-read after an integration would
 * widen a repair's bound to the default branch's work. An unreadable diff is
 * empty, which blocks a CI repair rather than inventing an intent for it.
 */
const readBranchDiff = async ({ cwd, defaultBranch }: { cwd: string; defaultBranch: string }) => {
	const maxDiffCharacters = 32_000;
	const forkPoint = await runGit({ command: `git merge-base ${quoteShellArgument({ argument: `origin/${defaultBranch}` })} HEAD`, cwd });

	if (forkPoint === undefined || forkPoint.exitCode !== 0) {
		return '';
	}

	const diffed = await runGit({ command: `git diff ${quoteShellArgument({ argument: forkPoint.stdout.trim() })} HEAD`, cwd });

	if (diffed === undefined || diffed.exitCode !== 0) {
		return '';
	}

	return diffed.stdout.length > maxDiffCharacters
		? `${diffed.stdout.slice(0, maxDiffCharacters)}\n… truncated: the branch's diff is longer than this`
		: diffed.stdout;
};

/**
 * Every exit path writes a result, because a tracker skill that finds no file
 * cannot tell "ship never ran" from "ship ran and stopped".
 *
 * Only a merge behind a newer base and failed checks readable enough to repair
 * earn another attempt; anything else would meet the same wall. The allowance is
 * never reset, so a default branch that keeps moving cannot spin this forever. A
 * retry starts from what the last attempt committed, so nothing the remote holds
 * is force-pushed or reset.
 */
export const runShip = async ({ cwd, settings, integration, workOrderGuard, onProgress }: Params): Promise<ShipResult> => {
	const preconditions = await checkShipPreconditions({ cwd, ticketPattern: settings.ticketPattern });

	if ('reason' in preconditions) {
		return stopShip({ cwd, onProgress, ...preconditions });
	}

	const { branch, defaultBranch, ticket } = preconditions;
	// Before the shipping record exists and before anything leaves the machine: a
	// ticket whose own record does not authorize the merge never starts a ship.
	const unauthorized = await workOrderGuard.authorize({ cwd, branch });

	if (unauthorized !== undefined) {
		return stopShip({ cwd, onProgress, reason: ShipBlockReason.WorkOrderNotAuthorized, detail: unauthorized, branch, ticketRef: ticket.ticket ?? branch });
	}

	const maxAttempts = 1 + maxCheapFixRetries;
	const recorder = new ShippingProgressRecorder({ cwd, branch, maxAttempts });

	recorder.beginAttempt({ attempt: 1 });

	const trackedProgress: ProgressSink = (message) => {
		onProgress?.(message);
		recorder.noteProgress({ message });
	};

	trackedProgress(`ship: ${branch} → ${defaultBranch}, ticket ${ticket.ticket}`);

	const branchDiff = await readBranchDiff({ cwd, defaultBranch });
	const attempt = { cwd, settings, integration, workOrderGuard, branch, defaultBranch, ticket, branchDiff, recorder, onProgress: trackedProgress };
	let outcome = await runShipAttempt(attempt);

	for (let spent = 1; spent < maxAttempts && outcome.retryable; spent += 1) {
		trackedProgress(`ship: attempt ${spent} did not merge — refreshing and trying again (${spent + 1} of ${maxAttempts})`);
		recorder.beginAttempt({ attempt: spent + 1 });
		outcome = await runShipAttempt({ ...attempt, ciEvidence: outcome.ciEvidence });
	}

	if (outcome.result.status === ShipStatus.Shipped) {
		const { mergeCommit } = outcome.result;

		// The merge is the freshest fact there is, so the ticket learns it before the
		// default-branch cleanup that could fail without undoing anything.
		if (mergeCommit !== undefined) {
			await workOrderGuard.recordShipped({ cwd, branch, mergeCommit });
		}

		recorder.startStep({ step: ShippingStepId.Sync });
		await syncDefaultBranch({ cwd, defaultBranch, branch, onProgress: trackedProgress });
		// Passed whatever the cleanup met: a sync that did not work is a progress line, never a failed ship.
		recorder.finishStep({ step: ShippingStepId.Sync, passed: true });
	}

	const result = await record({ cwd, onProgress: trackedProgress, result: outcome.result });

	await recorder.end();

	return result;
};
