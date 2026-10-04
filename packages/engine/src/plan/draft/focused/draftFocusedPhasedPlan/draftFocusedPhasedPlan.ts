import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { getBlockingFindings } from '#src/common/getBlockingFindings.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import { parsePhaseDeclarations } from '#src/plan/common/parsePhaseDeclarations.ts';
import { syncPlanDecisions } from '#src/plan/decisionLog/syncPlanDecisions/syncPlanDecisions.ts';
import type { DraftContext } from '#src/plan/draft/common/types/DraftContext.ts';
import type { RunPlanDraftResult } from '#src/plan/draft/common/types/RunPlanDraftResult.ts';
import { authorFocusedPlanFiles } from '#src/plan/draft/focused/common/authorFocusedPlanFiles.ts';
import { convergePlanStructure } from '#src/plan/draft/focused/common/convergePlanStructure/convergePlanStructure.ts';
import { createDraftStop } from '#src/plan/draft/focused/common/createDraftStop.ts';
import { getAdvisoryFindings } from '#src/plan/draft/focused/common/getAdvisoryFindings.ts';
import { planDraftOutputs } from '#src/plan/draft/focused/common/planDraftOutputs.ts';
import { renderDraftEvidenceBrief } from '#src/plan/draft/focused/common/renderDraftEvidenceBrief.ts';
import { authorFocusedPhaseFiles } from '#src/plan/draft/focused/draftFocusedPhasedPlan/authorFocusedPhaseFiles/authorFocusedPhaseFiles.ts';
import { repairPhaseBreakdown } from '#src/plan/draft/focused/draftFocusedPhasedPlan/repairPhaseBreakdown.ts';
import { stopForPhaseFailure } from '#src/plan/draft/focused/draftFocusedPhasedPlan/stopForPhaseFailure.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { syncGlobalConstraints } from '#src/plan/sections/syncGlobalConstraints.ts';
import { syncPhaseSectionsFromFiles } from '#src/plan/sections/syncPhaseSectionsFromFiles/syncPhaseSectionsFromFiles.ts';

interface Params {
	context: DraftContext;
	/** Names the overview spawn's transcript — `draft`, or `draft-overview` when this is a re-draft of an abandoned single plan. */
	step: string;
}

/**
 * Runs before any phase spawn is paid for. The overview is re-synced after the
 * check because a reshape round rewrites `overview.md`, and a phase writer
 * authors against the text in its prompt rather than the file.
 */
const readCheckedBreakdown = async ({
	params,
	decisions,
	advisories,
	draftStop,
}: {
	params: Parameters<typeof repairPhaseBreakdown>[0];
	decisions: DecisionsRecord;
	advisories: StructuralFinding[];
	draftStop: ReturnType<typeof createDraftStop>;
	// Stated rather than inferred: the inferred union gives the phase branch an
	// optional `stop`, which leaves `'stop' in checked` narrowing to both halves.
}): Promise<{ stop: RunPlanDraftResult } | { overviewText: string; declarations: ReturnType<typeof parsePhaseDeclarations> }> => {
	const { cwd, name, overviewPath } = params;
	const breakdown = await repairPhaseBreakdown(params);

	if (breakdown.status === PlanRunStatus.PausedRateLimit) {
		return { stop: draftStop({ status: PlanRunStatus.PausedRateLimit, error: breakdown.error }) };
	}

	if (breakdown.status === PlanRunStatus.Failed) {
		return { stop: draftStop({ status: PlanRunStatus.Failed, error: breakdown.error }) };
	}

	advisories.push(...getAdvisoryFindings({ findings: breakdown.findings }));

	if (getBlockingFindings({ findings: breakdown.findings }).length > 0) {
		return { stop: draftStop({ status: PlanRunStatus.StructuralIssues, findings: breakdown.findings, planPaths: [overviewPath] }) };
	}

	await syncPlanDecisions({ cwd, name, planPaths: [overviewPath], decisions });
	await syncGlobalConstraints({ planPaths: [overviewPath], decisions });

	const overviewText = await readFile(overviewPath, 'utf8');

	return { overviewText, declarations: parsePhaseDeclarations({ plan: parsePlan({ content: overviewText, base: basename(overviewPath) }) }) };
};

/**
 * `syncPhaseSectionsFromFiles` stamps the real counts before it renders, so it
 * runs after the phase files exist: rendering ahead of the stamp would write the
 * overview agent's estimated counts straight back over the real ones.
 */
const composeEngineSections = async ({
	cwd,
	name,
	overviewPath,
	phasePaths,
	decisions,
}: {
	cwd: string;
	name: string;
	overviewPath: string;
	phasePaths: string[];
	decisions: DecisionsRecord;
}) => {
	await syncPlanDecisions({ cwd, name, planPaths: phasePaths, decisions });
	await syncGlobalConstraints({ planPaths: [overviewPath, ...phasePaths], decisions });

	await syncPhaseSectionsFromFiles({ cwd, overviewPath, phasePaths });
};

/**
 * The overview spawn gets no self-lint, because at the end of it no phase file
 * exists and `resolvePlanDeliverable` would answer `no plan found` — handing an
 * agent a command that always errors teaches it to ignore the section.
 *
 * A phase that busts the created-file ceiling here surfaces as a blocking
 * finding from the closing lint and is deliberately not escalated to another
 * breakdown reshape: re-splitting would invalidate every phase file already
 * authored.
 */
export const draftFocusedPhasedPlan = async ({ context, step }: Params): Promise<RunPlanDraftResult> => {
	const { cwd, driver, name, workspaceDir, facts, decisions, brainstormDecisionsPath, config, executorFileLimit, evidence } = context;
	const { standards, model, effort, permissions, timeoutMs, level, progress } = context;
	const outputs = await planDraftOutputs({ cwd, name, variant: PlanVariant.Overview });
	const overviewPath = outputs[0].path;
	// Read at every stop: a breakdown warning gates nothing, but it is the human's
	// only notice of what reviewing this plan will cost, whichever way the draft ends.
	const advisories: StructuralFinding[] = [];
	// A focused context always carries evidence; the empty index is what a context wired without a collection narrows to.
	const collected = evidence ?? { planName: name, entries: [], collectedAt: new Date().toISOString() };
	const draftStop = createDraftStop({ workspaceDir, advisories });
	const authored = await authorFocusedPlanFiles({
		context,
		outputs,
		step,
		evidenceBrief: renderDraftEvidenceBrief({ evidence }),
	});

	if ('stop' in authored) {
		return authored.stop;
	}

	// By path rather than by deliverable: the folder holds only overview.md at
	// this moment, which `resolvePlanDeliverable` reads as no plan found.
	await syncPlanDecisions({ cwd, name, planPaths: [overviewPath], decisions });
	await syncGlobalConstraints({ planPaths: [overviewPath], decisions });

	const spawn = { cwd, driver, name, workspaceDir, model, effort, permissions, timeoutMs, level, progress };
	const checked = await readCheckedBreakdown({
		params: { ...spawn, overviewPath, brainstormDecisionsPath, executorFileLimit },
		decisions,
		advisories,
		draftStop,
	});

	if ('stop' in checked) {
		return checked.stop;
	}

	const phases = await authorFocusedPhaseFiles({
		...spawn,
		facts,
		decisions,
		overviewText: checked.overviewText,
		declarations: checked.declarations,
		evidence: collected,
		executorFileLimit,
		standards,
		docs: config?.docs,
		contract: config?.plan?.contract,
	});

	if (phases.status !== PlanRunStatus.Complete) {
		return stopForPhaseFailure({ phases, draftStop });
	}

	// Every plan file carries the engine's own sections before anything reads them:
	// the stamp inside, and the closing lint after.
	await composeEngineSections({ cwd, name, overviewPath, phasePaths: phases.planPaths, decisions });

	const converged = await convergePlanStructure({
		context,
		planPaths: [overviewPath, ...phases.planPaths],
		variant: PlanVariant.Overview,
		reports: [authored.report, ...phases.reports],
		advisories,
		overviewPath,
	});

	return converged.result;
};
