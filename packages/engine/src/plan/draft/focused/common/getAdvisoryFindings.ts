import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

interface Params {
	findings: StructuralFinding[];
}

export const getAdvisoryFindings = ({ findings }: Params): StructuralFinding[] => findings.filter((finding) => finding.severity === FindingSeverity.Advisory);
