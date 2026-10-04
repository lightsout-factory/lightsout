import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveRunDir } from '#src/common/resolveRunDir.ts';
import { jestReporterSource } from '#src/gates/testResults/internal/jestReporterSource.ts';

interface Params {
	cwd: string;
	runId: string;
}

/** Overwrites on every call, so an engine upgraded partway through a resumable run never leaves a stale reporter behind. */
export const writeJestReporter = async ({ cwd, runId }: Params): Promise<string> => {
	const runDir = await resolveRunDir({ cwd, runId });
	const reporterPath = join(runDir, 'jest-reporter.cjs');

	await mkdir(runDir, { recursive: true });
	await writeFile(reporterPath, jestReporterSource);

	return reporterPath;
};
