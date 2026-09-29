import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import type { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import { recordObservations } from '#src/plan/internal/common/memory/recordObservations.ts';

interface Params {
	memory: GradeMemory;
	phase: string;
	/** Absent keeps every state. */
	statuses?: GradeFindingStatus[];
}

/**
 * Matches any observation's plan file, not only the representative's, so a
 * grouped record is returned for each of its locations: a caller asking about
 * several plan files must de-duplicate by record id.
 */
export const phaseFindingRecords = ({ memory, phase, statuses }: Params): GradeFindingRecord[] =>
	memory.findings.filter((record) => {
		const touches = recordObservations({ record }).some((observation) => observation.phase === phase);

		return touches && (statuses === undefined || statuses.includes(record.status));
	});
