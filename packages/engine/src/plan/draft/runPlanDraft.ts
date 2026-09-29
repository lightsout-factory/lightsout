import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import { readOptionalConfig } from '#src/common/config/readOptionalConfig.ts';
import { defaultExecutorFileLimit } from '#src/common/constants/defaultExecutorFileLimit.ts';
import type { Effort } from '#src/contracts/Effort.ts';
import type { Permissions } from '#src/contracts/Permissions.ts';
import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { readMergedDecisions } from '#src/plan/decisionLog/readMergedDecisions.ts';
import { estimatePlanScope } from '#src/plan/draft/estimatePlanScope.ts';
import { draftFocusedPhasedPlan } from '#src/plan/draft/focused/draftFocusedPhasedPlan.ts';
import { draftFocusedSinglePlan } from '#src/plan/draft/focused/draftFocusedSinglePlan.ts';
import { collectSourceEvidence } from '#src/plan/evidence/collectSourceEvidence.ts';
import type { DraftContext } from '#src/plan/internal/common/types/DraftContext.ts';
import type { RunPlanDraftResult } from '#src/plan/internal/common/types/RunPlanDraftResult.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { readPlanFacts } from '#src/plan/readPlanFacts.ts';

interface Params {
	cwd: string;
	driver: Driver;
	/** Kebab plan name — the folder the plan's own files live in. */
	name: string;
	/** Force a variant; otherwise it is estimated from the facts' touched-file count. */
	scope?: PlanVariant;
	/** Supplemental code standards, threaded into the plan-writer invocation. */
	standards?: string;
	model?: string;
	effort?: Effort;
	permissions?: Permissions;
	timeoutMs?: number;
	/** The command-run level this draft's spawns attach to. Absent wherever no run is being recorded. */
	level?: ActivityLevel;
	onProgress?: (message: string) => void;
}

/**
 * Draft a structurally clean plan. The engine owns the *path* (told to the
 * agent) and *verifies* the write; the agent owns the content.
 *
 * A single plan is one spawn writing `plan.md`, converged by
 * `repairPlanStructure`. A phased plan is drafted in **two stages**: one spawn
 * authors `overview.md` alone — including the machine-readable per-phase
 * declaration — and then one spawn per declared phase runs concurrently against
 * that declaration. The single all-files spawn this replaces was killed at its
 * thirty-minute ceiling mid-draft on a ten-phase plan; the declaration is what
 * makes the phase agents safe to run at once, because none of them has to read
 * another's unfinished text, and the deterministic cross-phase lint catches the
 * provenance and hand-off mismatches a parallel drafter could introduce.
 *
 * Between the two stages sits a deterministic door check on the declared phase
 * sizes, with a bounded reshape loop behind it: the cheapest moment to refuse an
 * unbuildable phase is before any phase file has been paid for.
 *
 * Every writer is handed source evidence the engine collected once, rather than
 * each re-reading the same files, and asks its harness for a restricted agent
 * environment. A harness applies the controls it can express and runs the rest
 * as an ordinary session, so a draft runs on every harness: the controls save
 * tokens, and the plan is the same without them.
 *
 * `plan draft` overwrites an existing deliverable — it is the from-scratch
 * authoring step, never re-run mid-convergence. Brainstorm's settled rows are
 * merged in at read time, so the plan's own `decisions.json` stays plan-owned.
 */
export const runPlanDraft = async ({
	cwd,
	driver,
	name,
	scope,
	standards,
	model,
	effort,
	permissions,
	timeoutMs = 30 * 60 * 1000,
	level,
	onProgress,
}: Params): Promise<RunPlanDraftResult> => {
	const progress = onProgress ?? (() => undefined);
	const workspaceDir = await planWorkspaceDir({ cwd, name });

	await mkdir(workspaceDir, { recursive: true });

	const facts = await readPlanFacts({ cwd, name });
	const { merged, brainstorm } = await readMergedDecisions({ cwd, name, onProgress: progress });
	const config = await readOptionalConfig({ cwd });
	const executorFileLimit = config?.['executor-file-limit'] ?? defaultExecutorFileLimit;
	const variant = scope ?? estimatePlanScope({ facts, executorFileLimit });
	progress(`plan draft ${name}: variant ${variant} (${scope ? 'scope flag' : 'estimated'})`);

	const context: DraftContext = {
		cwd,
		driver,
		name,
		workspaceDir,
		facts,
		decisions: merged,
		brainstormDecisionsPath: brainstorm ? join(workspaceDir, 'brainstorm-decisions.json') : undefined,
		evidence: await collectSourceEvidence({ cwd, name, facts, config }),
		config,
		executorFileLimit,
		standards,
		model,
		effort,
		permissions,
		timeoutMs,
		level,
		progress,
	};

	return variant === PlanVariant.Single ? draftFocusedSinglePlan({ context }) : draftFocusedPhasedPlan({ context, step: 'draft' });
};
