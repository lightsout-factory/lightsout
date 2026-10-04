import { basename } from 'node:path';
import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { messageOf } from '#src/common/messageOf.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { resolvePlanDeliverable } from '#src/plan/common/resolvePlanDeliverable.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { decisionLogReference } from '#src/plan/decisionLog/decisionLogReference.ts';
import { readMergedDecisions } from '#src/plan/decisionLog/readMergedDecisions/readMergedDecisions.ts';
import { renderDecisionLog } from '#src/plan/decisionLog/renderDecisionLog.ts';
import { writeDecisionLogSection } from '#src/plan/decisionLog/syncPlanDecisions/writeDecisionLogSection.ts';
import { syncGlobalConstraints } from '#src/plan/sections/syncGlobalConstraints.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
	/** Already-merged rows; when absent they are read from the plan workspace. */
	decisions?: DecisionsRecord;
	/** Mid-draft the deliverable does not always resolve, so the draft flow passes its own paths. */
	planPaths?: string[];
}

type SyncPlanDecisionsResult = { status: typeof PlanRunStatus.Complete; files: SyncedPlanFile[] } | { status: typeof PlanRunStatus.Failed; error: string };

/**
 * A record nobody authored is a failed sync, not a crash.
 *
 * The return type is annotated because inferred, the union normalizes to one
 * member carrying an optional `error`, which breaks the caller's narrowing.
 */
const resolveDecisions = async ({
	cwd,
	name,
	decisions,
}: {
	cwd: string;
	name: string;
	decisions?: DecisionsRecord;
}): Promise<{ record: DecisionsRecord } | { error: string }> => {
	if (decisions !== undefined) {
		return { record: decisions };
	}

	try {
		const { merged } = await readMergedDecisions({ cwd, name });

		return { record: merged };
	} catch (error) {
		return { error: messageOf({ error }) };
	}
};

/**
 * Between the overview spawn and the first phase file the folder holds neither
 * `plan.md` nor a phase file, which `resolvePlanDeliverable` reads as no plan, so
 * the draft flow passes its own paths.
 *
 * Annotated for the same reason as `resolveDecisions`.
 */
const resolvePaths = async ({
	cwd,
	name,
	planPaths,
}: {
	cwd: string;
	name: string;
	planPaths?: string[];
}): Promise<{ paths: string[] } | { error: string }> => {
	if (planPaths !== undefined) {
		return { paths: planPaths };
	}

	const deliverable = await resolvePlanDeliverable({ cwd, name });

	if (deliverable.error !== undefined) {
		return { error: deliverable.error };
	}

	const isSinglePlan = deliverable.files.length === 1 && basename(deliverable.files[0]?.path ?? '') === 'plan.md';

	if (!isSinglePlan && deliverable.overviewPath === undefined) {
		return { error: `cannot sync decisions for '${name}': phase files need an overview.md to carry the Decision Log the phases point at` };
	}

	const overviewPaths = deliverable.overviewPath === undefined ? [] : [deliverable.overviewPath];

	return { paths: [...overviewPaths, ...deliverable.files.map((file) => file.path)] };
};

const foldSyncedFiles = ({ logs, constraints }: { logs: SyncedPlanFile[]; constraints: SyncedPlanFile[] }) => {
	const movedConstraints = new Map(constraints.map(({ path, updated }) => [path, updated]));

	return logs.map(({ path, updated }) => ({ path, updated: updated || (movedConstraints.get(path) ?? false) }));
};

/**
 * Phase files point at the overview's log so a phased plan keeps one history,
 * but every file gets the constraints, because a phase file is handed to an
 * implementing agent on its own. Both sections sync here because this is the
 * command the currency checks name as their remedy.
 *
 * Every failure is settled before the first write, so no deliverable is left
 * half-synced.
 */
export const syncPlanDecisions = async ({ cwd, name, decisions, planPaths }: Params): Promise<SyncPlanDecisionsResult> => {
	const resolvedPaths = await resolvePaths({ cwd, name, planPaths });

	if ('error' in resolvedPaths) {
		return { status: PlanRunStatus.Failed, error: resolvedPaths.error };
	}

	const resolved = await resolveDecisions({ cwd, name, decisions });

	if ('error' in resolved) {
		return { status: PlanRunStatus.Failed, error: resolved.error };
	}

	const table = renderDecisionLog({ decisions: resolved.record.decisions });
	const reference = decisionLogReference();
	const logs: SyncedPlanFile[] = [];

	for (const path of resolvedPaths.paths) {
		const base = basename(path);
		const section = base === 'plan.md' || base === 'overview.md' ? table : reference;

		logs.push(await writeDecisionLogSection({ path, section }));
	}

	const constraints = await syncGlobalConstraints({ planPaths: resolvedPaths.paths, decisions: resolved.record });

	return { status: PlanRunStatus.Complete, files: foldSyncedFiles({ logs, constraints }) };
};
