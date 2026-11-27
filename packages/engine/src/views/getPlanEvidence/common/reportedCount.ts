import type { EvidenceCount } from '#src/contracts/views/planEvidence/EvidenceCount.ts';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';

interface Params {
	value: number;
}

/** A figure an agent stated: a reviewer's verdict, a grader's finding. */
export const reportedCount = ({ value }: Params): EvidenceCount => ({ value, provenance: EvidenceProvenance.Reported });
