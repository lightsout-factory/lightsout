import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { getBlockingFindings } from '#src/common/getBlockingFindings.ts';
import type { PlanDraftReport } from '#src/contracts/plan/draft/PlanDraftReport.ts';
import type { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { DraftContext } from '#src/plan/draft/common/types/DraftContext.ts';
import type { RunPlanDraftResult } from '#src/plan/draft/common/types/RunPlanDraftResult.ts';
import { repairPlanStructure } from '#src/plan/draft/focused/common/convergePlanStructure/repairPlanStructure/repairPlanStructure.ts';
import { createDraftStop } from '#src/plan/draft/focused/common/createDraftStop.ts';
import { getAdvisoryFindings } from '#src/plan/draft/focused/common/getAdvisoryFindings.ts';

interface Params {
	context: DraftContext;
	/** Every file the draft authored — the whole set, because a cross-phase finding needs two files in view. */
	planPaths: string[];
	/** The variant a converged draft reports it came out as. */
	variant: PlanVariant;
	/** One report per spawn, in spawn order — the overview's first on a phased draft. */
	reports: PlanDraftReport[];
	/** Accumulated advisories, appended to by this step and read at whichever exit it produces. */
	advisories: StructuralFinding[];
	/** Forwarded to `repairPlanStructure` — the overview of a phased deliverable. */
	overviewPath?: string;
}

/**
 * The blocking findings come back beside the result because the single flow
 * acts on them: a busted file ceiling is one the structural repairer can never
 * resolve, so it escalates to a phased re-draft instead.
 */
export const convergePlanStructure = async ({
	context,
	planPaths,
	variant,
	reports,
	advisories,
	overviewPath,
}: Params): Promise<{ result: RunPlanDraftResult; blocking: StructuralFinding[] }> => {
	const { cwd, driver, name, workspaceDir, brainstormDecisionsPath, decisions, config, model, effort, permissions, timeoutMs, level, progress } = context;
	const draftStop = createDraftStop({ workspaceDir, advisories });
	const repaired = await repairPlanStructure({
		cwd,
		driver,
		name,
		planPaths,
		workspaceDir,
		brainstormDecisionsPath,
		decisions,
		config,
		model,
		effort,
		permissions,
		timeoutMs,
		level,
		progress,
		overviewPath,
	});

	if (repaired.status === PlanRunStatus.PausedRateLimit) {
		return { result: draftStop({ status: PlanRunStatus.PausedRateLimit, error: repaired.error }), blocking: [] };
	}

	if (repaired.status === PlanRunStatus.Failed) {
		return { result: draftStop({ status: PlanRunStatus.Failed, error: repaired.error }), blocking: [] };
	}

	advisories.push(...getAdvisoryFindings({ findings: repaired.findings }));

	const blocking = getBlockingFindings({ findings: repaired.findings });

	if (blocking.length > 0) {
		return { result: draftStop({ status: PlanRunStatus.StructuralIssues, findings: repaired.findings, planPaths }), blocking };
	}

	progress(`plan draft ${name}: structurally clean (${planPaths.length} file(s))`);

	return { result: draftStop({ status: PlanRunStatus.Complete, planPaths, variant, reports }), blocking };
};
