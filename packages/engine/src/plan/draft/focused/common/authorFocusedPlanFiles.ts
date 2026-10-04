import { buildFocusedPlanWriterInvocation } from '#src/agents/buildFocusedPlanWriterInvocation/buildFocusedPlanWriterInvocation.ts';
import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import { touchedFileCeiling } from '#src/common/constants/touchedFileCeiling.ts';
import { PlanDraftReport } from '#src/contracts/plan/draft/PlanDraftReport.ts';
import { PlanDraftStatus } from '#src/contracts/plan/draft/PlanDraftStatus.ts';
import { createdFileCeiling } from '#src/plan/common/constants/createdFileCeiling.ts';
import { createPlanAgentRunner } from '#src/plan/common/createPlanAgentRunner.ts';
import type { DraftContext } from '#src/plan/draft/common/types/DraftContext.ts';
import type { RunPlanDraftResult } from '#src/plan/draft/common/types/RunPlanDraftResult.ts';
import { planWriterEnvironment } from '#src/plan/draft/focused/common/constants/planWriterEnvironment/planWriterEnvironment.ts';
import { createDraftStop } from '#src/plan/draft/focused/common/createDraftStop.ts';
import type { planDraftOutputs } from '#src/plan/draft/focused/common/planDraftOutputs.ts';
import { verifyDraftedFiles } from '#src/plan/draft/focused/common/verifyDraftedFiles.ts';

interface Params {
	context: DraftContext;
	/** Where to write, and which template variant applies — the engine's paths, never the agent's. */
	outputs: Awaited<ReturnType<typeof planDraftOutputs>>;
	/** Names this spawn's transcript: `draft`, or `draft-overview` for the overview of a phased re-draft. */
	step: string;
	/** The engine's collected source evidence for this assignment, already rendered. */
	evidenceBrief: string;
	/** The self-lint command and the prefix it is granted. Absent on an overview spawn: no phase file exists yet, so the lint would only ever error. */
	lint?: { prefix: string; command: string };
	/** The Decision Log sync command and the prefix it is granted, run before the self-lint. Absent on an overview spawn for the same reason `lint` is. */
	sync?: { prefix: string; command: string };
}

/**
 * A facts/decisions discrepancy the agent found is not a drafting bug — the
 * inputs are wrong — so it is surfaced and never looped on.
 *
 * The focused environment narrows the built-in tool set; it never touches the
 * command grant.
 */
export const authorFocusedPlanFiles = async ({
	context,
	outputs,
	step,
	evidenceBrief,
	lint,
	sync,
}: Params): Promise<{ stop: RunPlanDraftResult } | { planPaths: string[]; report: PlanDraftReport }> => {
	const { cwd, driver, name, workspaceDir, facts, decisions, executorFileLimit, standards, config, model, effort, permissions, timeoutMs } = context;
	// Nothing has been checked yet at any of this step's exits.
	const draftStop = createDraftStop({ workspaceDir, advisories: [] });
	const invokePlanAgent = createPlanAgentRunner({
		cwd,
		driver,
		workspaceDir,
		step,
		model,
		effort,
		permissions,
		timeoutMs,
		environment: planWriterEnvironment,
		level: context.level,
	});
	const grantedPrefixes = [sync?.prefix, lint?.prefix].filter((prefix) => prefix !== undefined);
	const outcome = await invokePlanAgent({
		invocation: buildFocusedPlanWriterInvocation({
			facts,
			decisions,
			outputs,
			limits: { executorFileLimit, createdFileCeiling, touchedFileCeiling },
			standards,
			lintCommand: lint?.command,
			syncCommand: sync?.command,
			docs: config?.docs,
			contract: config?.plan?.contract,
			evidenceBrief,
		}),
		contract: PlanDraftReport,
		allowedCommands: grantedPrefixes.length > 0 ? grantedPrefixes : undefined,
	});

	if (!outcome.ok) {
		return {
			stop: outcome.rateLimited
				? draftStop({ status: PlanRunStatus.PausedRateLimit, error: `rate limited or overloaded — re-run: lightsout plan draft --name ${name}` })
				: draftStop({ status: PlanRunStatus.Failed, error: outcome.failure }),
		};
	}

	const { report } = outcome;

	if (report.status === PlanDraftStatus.Error) {
		return { stop: draftStop({ status: PlanRunStatus.FactsError, discrepancies: report.discrepancies }) };
	}

	const drafted = await verifyDraftedFiles({ cwd, filesWritten: report.filesWritten });

	if ('error' in drafted) {
		return { stop: draftStop({ status: PlanRunStatus.Failed, error: drafted.error }) };
	}

	return { planPaths: drafted.planPaths, report };
};
