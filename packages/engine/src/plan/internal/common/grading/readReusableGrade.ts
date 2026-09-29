import { readJsonFile } from '#src/common/utils/readJsonFile.ts';
import { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import { GradeScope } from '#src/contracts/plan/memory/GradeScope.ts';

interface Params {
	gradePath: string;
	sha256: string;
}

/**
 * The memory cannot speak for the file beside it: a structural preflight stop
 * after a passing review rewrites `grade.json` without touching the memory, so
 * the verdict on disk has to say for itself that it is complete, passing,
 * full-scope and measured against these very inputs.
 */
export const readReusableGrade = async ({ gradePath, sha256 }: Params): Promise<GradeReport | undefined> => {
	const report = await readJsonFile({ path: gradePath, schema: GradeReport });
	const qualifies = report?.passed === true && report.complete && report.scope === GradeScope.Full && report.inputs?.sha256 === sha256;

	return qualifies ? report : undefined;
};
