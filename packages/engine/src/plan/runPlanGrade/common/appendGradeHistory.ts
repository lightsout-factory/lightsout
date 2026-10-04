import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import { gradeHistoryPath } from '#src/plan/gradeHistoryPath.ts';

interface Params {
	cwd: string;
	name: string;
	report: GradeReport;
}

/**
 * The report is parsed on the way out, so a malformed line is never written and
 * then silently skipped on the way back in.
 *
 * Not `appendJsonlRecords`: that writer stamps a `runId`, and a grading pass has
 * no run to name. The report's own `gradedAt` and `gradedCommit` say when and
 * against what.
 */
export const appendGradeHistory = async ({ cwd, name, report }: Params): Promise<void> => {
	const path = await gradeHistoryPath({ cwd, name });

	await mkdir(dirname(path), { recursive: true });
	await appendFile(path, `${JSON.stringify(GradeReport.parse(report))}\n`, 'utf8');
};
