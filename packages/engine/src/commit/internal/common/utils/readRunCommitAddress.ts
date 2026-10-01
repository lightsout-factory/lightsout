import { basename, extname } from 'node:path';
import type { CommitAddress } from '#src/commit/internal/common/types/CommitAddress.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';
import { readRunLabel } from '#src/common/utils/readRunLabel.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { planNameFromPath } from '#src/plan/planNameFromPath.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

/** A phase child run's plan is its own phase file, so the file's stem is appended to the plan id. */
const readUnit = async ({ cwd, plan, planName }: { cwd: string; plan: string; planName?: string }) => {
	// The recorded name is preferred: the path is spelled by whoever started the run.
	const name = planName ?? (await planNameFromPath({ cwd, planPath: plan }));
	const stem = basename(plan, extname(plan));

	const address = name === undefined ? undefined : parsePlanAddress({ name });

	if (address === undefined) {
		return { unit: stem };
	}

	return { unit: stem === 'plan' ? address.planId : `${address.planId}/${stem}`, workOrderName: address.workOrderName, planId: address.planId };
};

/**
 * An unreadable state file is narrated and treated as absent: nothing parses a commit
 * subject, so failing a verified unit over it would cost more than the fallback.
 */
const readTicketFacts = async ({
	cwd,
	workOrderName,
	planId,
	onProgress,
}: {
	cwd: string;
	workOrderName?: string;
	planId?: string;
	onProgress: (message: string) => void;
}) => {
	if (workOrderName === undefined) {
		return {};
	}

	const read = await readWorkOrderState({ cwd, name: workOrderName });

	if ('error' in read) {
		onProgress(`the work order state for ${workOrderName} could not be read, so this commit is addressed from the branch instead — ${read.error}`);

		return {};
	}

	return { ticketRef: read.record?.ticketRef, title: read.record?.plans.find((plan) => plan.id === planId)?.title };
};

interface Params {
	cwd: string;
	manifest: RunManifest;
	onProgress: (message: string) => void;
}

/** Reads the manifest rather than taking the facts as parameters, because the manifest already carries the plan path each one derives from. */
export const readRunCommitAddress = async ({ cwd, manifest, onProgress }: Params): Promise<CommitAddress> => {
	const { unit, workOrderName, planId } = await readUnit({ cwd, plan: manifest.plan, planName: manifest.planName });
	const { ticketRef, title } = await readTicketFacts({ cwd, workOrderName, planId, onProgress });
	const reference = ticketRef ?? (await readRunLabel({ cwd }));

	return {
		reference,
		unit,
		fallbackSubject: title === undefined ? `${reference} ${unit}` : `${reference} ${unit}: ${title}`,
		context: title === undefined ? `Plan ${unit}` : `Plan ${unit}: ${title}`,
	};
};
