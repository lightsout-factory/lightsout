import { writeJsonFile } from '#src/common/utils/writeJsonFile.ts';
import { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import { gradeMemoryPath } from '#src/plan/common/utils/gradeMemoryPath.ts';

interface Params {
	cwd: string;
	name: string;
	memory: GradeMemory;
}

/** Parsed on the way out so a malformed record can never reach disk and then refuse the next pass. */
export const writeGradeMemory = async ({ cwd, name, memory }: Params): Promise<void> => {
	await writeJsonFile({ path: await gradeMemoryPath({ cwd, name }), value: GradeMemory.parse(memory) });
};
