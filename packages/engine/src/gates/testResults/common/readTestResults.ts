import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { readJsonFile } from '#src/common/json/readJsonFile.ts';
import { TestResultsFile } from '#src/contracts/gates/TestResultsFile.ts';

interface Params {
	cwd: string;
	/** Absolute path of one gate execution's results directory. */
	dir: string;
}

/**
 * Paths are made repo-relative because the runner reports absolute ones. A missing directory
 * or a bad results file answers an empty list; each caller decides what empty means.
 */
export const readTestResults = async ({ cwd, dir }: Params): Promise<TestResultsFile['testResults']> => {
	const entries: string[] = await readdir(dir).catch(() => []);
	const merged: TestResultsFile['testResults'] = [];

	for (const entry of entries.filter((name) => name.endsWith('.json'))) {
		const parsed = await readJsonFile({ path: join(dir, entry), schema: TestResultsFile });

		merged.push(...(parsed?.testResults ?? []).map((file) => ({ ...file, testFilePath: relative(cwd, file.testFilePath) })));
	}

	return merged;
};
