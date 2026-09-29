import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

interface Params {
	findings: StructuralFinding[];
}

/** Callers read this rather than a length, so an advisory finding can never fail a plan by being counted. */
export const getBlockingFindings = ({ findings }: Params): StructuralFinding[] => findings.filter((finding) => finding.severity === FindingSeverity.Blocking);
