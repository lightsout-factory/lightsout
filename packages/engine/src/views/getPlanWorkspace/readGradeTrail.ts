import { join } from 'node:path';
import { gradeMemoryFileName } from '#src/common/constants/gradeMemoryFileName.ts';
import { readJsonlRecords } from '#src/common/json/readJsonlRecords.ts';
import { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import { GradePass } from '#src/contracts/views/planWorkspace/GradePass.ts';
import type { PlanWorkspaceFiles } from '#src/views/common/types/PlanWorkspaceFiles.ts';
import { readPlanRecord } from '#src/views/getPlanWorkspace/readPlanRecord.ts';

const historyFileName = 'grade-history.jsonl';

interface Params {
	/** The absolute workspace folder. */
	rootPath: string;
	files: PlanWorkspaceFiles;
}

/**
 * How the plan's grade moved: every pass in the order it was taken, and every
 * finding the grader keeps across passes with how it was settled.
 *
 * The ledger is append-only and may be read mid-write, so a line that will not
 * parse is skipped rather than reported. The memory is one whole record, so a
 * corrupt one is a problem the page shows.
 */
export const readGradeTrail = async ({ rootPath, files }: Params) => {
	const [gradePasses, memory] = await Promise.all([
		files.others.get(historyFileName) === undefined ? [] : readJsonlRecords({ path: join(rootPath, historyFileName), schema: GradePass }),
		readPlanRecord({ dir: rootPath, file: files.others.get(gradeMemoryFileName), schema: GradeMemory }),
	]);

	return { gradePasses, gradeFindings: memory.value?.findings ?? [], problem: memory.problem };
};
