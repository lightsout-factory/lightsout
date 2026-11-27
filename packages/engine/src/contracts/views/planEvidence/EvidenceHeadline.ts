import { z } from 'zod';
import { EvidenceCount } from '#src/contracts/views/planEvidence/EvidenceCount.ts';

/**
 * The headline row of one plan's evidence, or of a work order's totals. It carries no
 * duration: a display derives plan-to-merge time from `startedAt` and `mergedAt`, counting
 * to now while unmerged, so the figure never freezes at fetch time.
 */
export const EvidenceHeadline = z.object({
	/** The earliest `startedAt` among the plan's activity-report roots; absent when no activity was recorded. */
	startedAt: z.string().optional(),
	/** When the work order's branch merged; absent while unmerged. */
	mergedAt: z.string().optional(),
	/** `decisions.json` rows whose `assumption` is false. Absent when no decisions record was read. Measured. */
	questionsAsked: EvidenceCount.optional(),
	/** `totals.usage.costUsd` of the plan's activity report; absent when no process reported a cost. Measured. */
	recordedCostUsd: EvidenceCount.optional(),
	/** Blocking findings handed to cleanup that no longer stand, summed across the build family; absent when no cleanup record carries `targeted`. Measured. */
	findingsFixed: EvidenceCount.optional(),
});

export type EvidenceHeadline = z.infer<typeof EvidenceHeadline>;
