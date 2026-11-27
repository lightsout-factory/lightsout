import type { z } from 'zod';
import { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';

/**
 * One grading pass as a reader of the plan's history needs it: when, the
 * verdict, and what it found. The fingerprints and coverage a whole report also
 * carries are the grader's own bookkeeping and stay on disk.
 */
export const GradePass = GradeReport.pick({
	gradedAt: true,
	grade: true,
	passed: true,
	complete: true,
	incompleteReason: true,
	structural: true,
	gaps: true,
});

export type GradePass = z.infer<typeof GradePass>;
