import { readJsonlRecords } from '#src/common/json/readJsonlRecords.ts';
import { ReviewFindingRecord } from '#src/contracts/standardsCheck/ReviewFindingRecord.ts';
import { getReviewFindingsPath } from '#src/runState/common/getReviewFindingsPath.ts';

interface Params {
	cwd: string;
}

export const readReviewFindings = async ({ cwd }: Params): Promise<ReviewFindingRecord[]> =>
	readJsonlRecords({ path: await getReviewFindingsPath({ cwd }), schema: ReviewFindingRecord });
