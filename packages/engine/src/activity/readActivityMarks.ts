import { activityRecordPath } from '#src/activity/activityRecordPath.ts';
import { readJsonlRecords } from '#src/common/utils/readJsonlRecords.ts';
import { ActivityMark } from '#src/contracts/activity/ActivityMark.ts';

interface Params {
	/** The directory holding the record. A directory with no record reads as no marks. */
	dir: string;
}

/**
 * Malformed lines are skipped, so a record whose last line was cut off when its
 * process was killed reads to its last complete mark.
 */
export const readActivityMarks = async ({ dir }: Params): Promise<ActivityMark[]> =>
	readJsonlRecords({ path: activityRecordPath({ dir }), schema: ActivityMark });
