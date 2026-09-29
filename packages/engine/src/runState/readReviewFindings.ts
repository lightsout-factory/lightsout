import { readJsonlRecords } from '#src/common/utils/readJsonlRecords.ts';
import { ReviewFindingRecord } from '#src/contracts/standardsCheck/ReviewFindingRecord.ts';
import { getReviewFindingsPath } from '#src/runState/internal/common/paths/getReviewFindingsPath.ts';

interface Params {
	cwd: string;
}

export const readReviewFindings = async ({ cwd }: Params): Promise<ReviewFindingRecord[]> =>
	readJsonlRecords({ path: await getReviewFindingsPath({ cwd }), schema: ReviewFindingRecord });
