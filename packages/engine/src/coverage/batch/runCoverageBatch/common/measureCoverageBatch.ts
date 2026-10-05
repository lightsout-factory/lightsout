import type { CoverageBatchReport } from '#src/contracts/coverage/CoverageBatchReport.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { runCoverageCheck } from '#src/coverage/common/runCoverageCheck.ts';
import type { CoverageBatch } from '#src/coverage/common/types/CoverageBatch.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
	runId: string;
	batch: CoverageBatch;
}

/** A batch resolves when any tracked file's statements percentage strictly improved. */
export const measureCoverageBatch = async ({ cwd, config, runId, batch }: Params): Promise<{ files: CoverageBatchReport['files']; improved: boolean }> => {
	const measured = await runCoverageCheck({ cwd, config, scope: batch.scope, runId, step: batch.id });
	const pctByPath = new Map(measured.files.map((file) => [file.path, file.statementsPct]));
	// A file absent from the fresh summary counts as unimproved: the writer
	// covered nothing the measurement can see.
	const files = batch.files.map((file) => ({ path: file.path, beforePct: file.statementsPct, afterPct: pctByPath.get(file.path) ?? file.statementsPct }));

	return { files, improved: files.some((file) => file.afterPct > file.beforePct) };
};
