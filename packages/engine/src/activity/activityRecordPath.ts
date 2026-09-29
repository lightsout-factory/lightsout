import { join } from 'node:path';
import { activityRecordFileName } from '#src/activity/common/constants/activityRecordFileName.ts';

interface Params {
	/** The directory the record lives in. Asking for the path creates nothing. */
	dir: string;
}

export const activityRecordPath = ({ dir }: Params): string => join(dir, activityRecordFileName);
