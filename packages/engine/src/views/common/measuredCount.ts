import type { EvidenceCount } from '#src/contracts/views/planEvidence/EvidenceCount.ts';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';

interface Params {
	value: number;
}

/** A figure the engine counted itself from a deterministic record. */
export const measuredCount = ({ value }: Params): EvidenceCount => ({ value, provenance: EvidenceProvenance.Measured });
