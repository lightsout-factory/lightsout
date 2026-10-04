import { readFile } from 'node:fs/promises';
import { gradeMemoryPath } from '#src/common/gradeMemoryPath.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { pathExists } from '#src/common/pathExists.ts';
import { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';

interface Params {
	cwd: string;
	name: string;
}

const readJson = async ({ path }: { path: string }): Promise<{ value: unknown } | { failure: string }> => {
	const text = await readFile(path, 'utf8');

	try {
		const value: unknown = JSON.parse(text);

		return { value };
	} catch (error) {
		return { failure: messageOf({ error }) };
	}
};

/**
 * Present but unreadable throws rather than starting fresh: grading on from a
 * record the engine could not read could discard the questions still open and
 * report the plan clean.
 */
export const readGradeMemory = async ({ cwd, name }: Params): Promise<GradeMemory | undefined> => {
	const path = await gradeMemoryPath({ cwd, name });

	if (!(await pathExists({ path }))) {
		return undefined;
	}

	const read = await readJson({ path });

	if ('failure' in read) {
		throw new Error(`the finding memory at ${path} is not readable JSON: ${read.failure}`);
	}

	const parsed = GradeMemory.safeParse(read.value);

	if (!parsed.success) {
		throw new Error(`the finding memory at ${path} is not a readable grade memory: ${parsed.error.message}`);
	}

	return parsed.data;
};
