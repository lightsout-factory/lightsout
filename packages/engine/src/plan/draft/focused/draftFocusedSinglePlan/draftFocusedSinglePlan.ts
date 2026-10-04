import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { buildPlanSyncDecisionsCommand } from '#src/plan/decisionLog/buildPlanSyncDecisionsCommand.ts';
import { syncPlanDecisions } from '#src/plan/decisionLog/syncPlanDecisions/syncPlanDecisions.ts';
import type { DraftContext } from '#src/plan/draft/common/types/DraftContext.ts';
import type { RunPlanDraftResult } from '#src/plan/draft/common/types/RunPlanDraftResult.ts';
import { authorFocusedPlanFiles } from '#src/plan/draft/focused/common/authorFocusedPlanFiles.ts';
import { convergePlanStructure } from '#src/plan/draft/focused/common/convergePlanStructure/convergePlanStructure.ts';
import { createDraftStop } from '#src/plan/draft/focused/common/createDraftStop.ts';
import { planDraftOutputs } from '#src/plan/draft/focused/common/planDraftOutputs.ts';
import { renderDraftEvidenceBrief } from '#src/plan/draft/focused/common/renderDraftEvidenceBrief.ts';
import { draftFocusedPhasedPlan } from '#src/plan/draft/focused/draftFocusedPhasedPlan/draftFocusedPhasedPlan.ts';
import { buildPlanLintCommand } from '#src/plan/draft/focused/draftFocusedSinglePlan/buildPlanLintCommand.ts';
import { deleteAbandonedPlan } from '#src/plan/draft/focused/draftFocusedSinglePlan/deleteAbandonedPlan.ts';
import { syncGlobalConstraints } from '#src/plan/sections/syncGlobalConstraints.ts';

interface Params {
	context: DraftContext;
}

/**
 * A single plan cannot be split by the structural repairer — the engine hands it
 * exactly one output path — so a busted created-file or touched-file ceiling is
 * a blocking finding that loop can never resolve. The draft re-runs once as
 * phased instead; the phased flow never escalates back, so the retry happens at
 * most once.
 */
export const draftFocusedSinglePlan = async ({ context }: Params): Promise<RunPlanDraftResult> => {
	const { cwd, name, workspaceDir, decisions, evidence, progress } = context;
	const outputs = await planDraftOutputs({ cwd, name, variant: PlanVariant.Single });
	// Appended to once the closing lint has run, and read at every stop, so no
	// exit can be added that quietly drops what the human was told.
	const advisories: StructuralFinding[] = [];
	const draftStop = createDraftStop({ workspaceDir, advisories });
	const authored = await authorFocusedPlanFiles({
		context,
		outputs,
		step: 'draft',
		evidenceBrief: renderDraftEvidenceBrief({ evidence }),
		lint: buildPlanLintCommand({ cwd, name }),
		sync: buildPlanSyncDecisionsCommand({ cwd, name }),
	});

	if ('stop' in authored) {
		return authored.stop;
	}

	const { planPaths, report } = authored;

	// The writer may already have run the same sync, but a denied tool or a
	// skipped self-lint must not decide whether the linted plan carries current sections.
	await syncPlanDecisions({ cwd, name, planPaths, decisions });
	await syncGlobalConstraints({ planPaths, decisions });

	const converged = await convergePlanStructure({
		context,
		planPaths,
		variant: PlanVariant.Single,
		reports: [report],
		advisories,
	});
	const overCeiling = converged.blocking.find(
		(finding) => finding.check === StructuralCheck.CreatedFilesWithinCeiling || finding.check === StructuralCheck.TouchedFilesWithinCeiling,
	);

	if (overCeiling) {
		progress(`plan draft ${name}: ${overCeiling.issue} — deleting ${outputs[0].path} and re-drafting phased`);

		const undeleted = await deleteAbandonedPlan({ path: outputs[0].path });

		return undeleted === undefined
			? draftFocusedPhasedPlan({ context, step: 'draft-overview' })
			: draftStop({ status: PlanRunStatus.Failed, error: undeleted });
	}

	return converged.result;
};
