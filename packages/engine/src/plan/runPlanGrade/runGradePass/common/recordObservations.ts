import type { GapObservation } from '#src/contracts/plan/grade/GapObservation.ts';
import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { gapObservations } from '#src/plan/runPlanGrade/runGradePass/common/gapObservations.ts';

interface Params {
	record: GradeFindingRecord;
}

/** Delegates to `gapObservations`, so a record and the gap it was opened from can never read one list two ways. */
export const recordObservations = ({ record }: Params): GapObservation[] => gapObservations({ gap: record });
