import { z } from 'zod';
import { DedupReport } from '#src/contracts/dedup/DedupReport.ts';
import { BrainstormDecisions } from '#src/contracts/plan/decisions/BrainstormDecisions.ts';
import { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import { PlanFacts } from '#src/contracts/plan/facts/PlanFacts.ts';
import { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
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
});

export type PlanWorkspaceView = z.infer<typeof PlanWorkspaceView>;
