import { z } from 'zod';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';

export const StructuralFinding = z.object({
	check: z.enum(StructuralCheck),
	/** An advisory finding prints and gates nothing. */
	severity: z.enum(FindingSeverity),
	/** Which plan file the defect is in: a phase file's basename, `overview.md`, or `plan.md`. */
	phase: z.string(),
	issue: z.string(),
	location: z.string(),
	fix: z.string(),
});

export type StructuralFinding = z.infer<typeof StructuralFinding>;
