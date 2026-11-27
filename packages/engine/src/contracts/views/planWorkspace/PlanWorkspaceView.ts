import { z } from 'zod';
import { DedupReport } from '#src/contracts/dedup/DedupReport.ts';
import { BrainstormDecisions } from '#src/contracts/plan/decisions/BrainstormDecisions.ts';
import { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';
import { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { GradePass } from '#src/contracts/views/planWorkspace/GradePass.ts';
import { PlanWorkspaceFile } from '#src/contracts/views/planWorkspace/PlanWorkspaceFile.ts';
import { PlanWorkspaceListing } from '#src/contracts/views/planWorkspace/PlanWorkspaceListing.ts';
import { RunListing } from '#src/contracts/views/RunListing.ts';

/**
 * Each record is optional because a workspace is readable at every point while
 * it is built up; `problems` names each file that exists but would not parse,
 * so it never reads as absent.
 */
export const PlanWorkspaceView = z.object({
	listing: PlanWorkspaceListing,
	/** Absolute workspace folder. */
	rootPath: z.string(),
	/** `plan.md`, or `overview.md`, whichever the workspace has; absent before drafting. */
	planFile: PlanWorkspaceFile.optional(),
	/** `phase<N>-<slug>.md` files in numeric order; empty for a single plan. */
	phaseFiles: z.array(PlanWorkspaceFile).default([]),
	/** `brainstorm-notes.md`, when `/brainstorm` wrote one. */
	notesFile: PlanWorkspaceFile.optional(),
	facts: PlanFacts.optional(),
	decisions: DecisionsRecord.optional(),
	brainstormDecisions: BrainstormDecisions.optional(),
	grade: GradeReport.optional(),
	dedup: DedupReport.optional(),
	/** Agent transcripts, named and sized but never read. */
	transcripts: z.array(PlanWorkspaceFile).default([]),
	/** Every run whose `plan` path sits inside this workspace, newest first. */
	runs: z.array(RunListing).default([]),
	/** One line per file that exists but would not parse — a corrupt workspace is shown, not hidden. */
	problems: z.array(z.string()).default([]),
	/** The text of `planFile`; absent before drafting. */
	planText: z.string().optional(),
	/** The text of `notesFile`; absent when `/brainstorm` wrote none. */
	notesText: z.string().optional(),
	/**
	 * Open phase files and the archived `implemented/` ones together, in phase-number
	 * order, each named without the `implemented/` prefix. A phase that could not be
	 * read keeps its place with empty text, and `problems` names it.
	 */
	phases: z.array(z.object({ name: z.string(), text: z.string(), implemented: z.boolean() })).default([]),
	/** One row per planning step in step order; a running step whose process is gone reads as failed with no duration. */
	planningSteps: z
		.array(
			z.object({
				id: z.enum(PlanningStep),
				status: z.enum(RunStatus).optional(),
				attempts: z.number(),
				durationMs: z.number().optional(),
			}),
		)
		.default([]),
	/** A planning step is running under a live process right now. */
	planningLive: z.boolean().default(false),
	/** Every grading pass `grade-history.jsonl` holds, oldest first; empty on a machine that only fetched the plan, because the ledger never travels. */
	gradePasses: z.array(GradePass).default([]),
	/** Every finding `grade-memory.json` keeps across passes, in the order each was first raised, with how it was settled. */
	gradeFindings: z.array(GradeFindingRecord).default([]),
});

export type PlanWorkspaceView = z.infer<typeof PlanWorkspaceView>;
