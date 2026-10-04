import { findingLocations } from '#src/common/findingLocations.ts';
import type { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';
import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import { dedupeObservations } from '#src/plan/runPlanGrade/runGradePass/common/dedupeObservations.ts';
import { recordObservations } from '#src/plan/runPlanGrade/runGradePass/common/recordObservations.ts';
import { reopenRecord } from '#src/plan/runPlanGrade/runGradePass/common/reopenRecord.ts';

interface Params {
	record: GradeFindingRecord;
	observations: GapObservation[];
	at: string;
}

/**
 * A resolved record that gains a plan file its resolutions hold no citation for
 * is reopened: a closure is a claim about specific locations, and inheriting it
 * would turn an unproven repair into an approval. What the record held is read
 * through `recordObservations`, so a single-observation record keeps its own
 * location.
 */
export const absorbObservations = ({ record, observations, at }: Params): GradeFindingRecord => {
	const merged = { ...record, observations: dedupeObservations({ observations: [...recordObservations({ record }), ...observations] }) };
	const cited = new Set(record.resolutions.map(({ phase }) => phase));
	const uncovered = findingLocations({ observations: merged.observations, phase: record.phase }).filter((location) => !cited.has(location));
	const reason = `gained an observation at ${uncovered.join(', ')}, where no confirmed citation closes it`;

	return record.status === GradeFindingStatus.Resolved && uncovered.length > 0 ? reopenRecord({ record: merged, reason, at }) : merged;
};
