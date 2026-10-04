import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { approveTestFiles } from '#src/pipeline/approvedTests/approveTestFiles.ts';
import { readApprovedTest } from '#src/pipeline/approvedTests/readApprovedTest.ts';
import { isSnapshotFile } from '#src/pipeline/common/isSnapshotFile.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';

interface Params {
	run: PipelineRun;
}

/**
 * Jest writes a brand-new `.snap` during the gate run with no agent behind it; only that first
 * write is approved, so the runner's output never reaches the next checkpoint as an edit to a
 * test. A snapshot recreated over an approved removal is left for the reviewer, because jest
 * writes a deleted snapshot green. A changed snapshot never reaches here: jest fails a
 * mismatch rather than rewriting it.
 */
export const approveRunnerSnapshots = async ({ run }: Params): Promise<number> => {
	const manifest = run.current();
	const seen = [...((await readGitChangedFiles({ cwd: run.cwd })) ?? []), ...manifest.changedFiles];
	const snapshots = [...new Set(seen)].filter((path) => isSnapshotFile({ path }) && !manifest.approvedTests.some((record) => record.path === path));
	const written: string[] = [];

	for (const path of snapshots) {
		if ((await readApprovedTest({ run, path })) === undefined) {
			written.push(path);
		}
	}

	if (written.length === 0) {
		return 0;
	}

	await run.update({ patch: { approvedTests: await approveTestFiles({ run, paths: written }) } });
	run.progress(`${manifest.currentStep ?? 'verify'}: ${written.length} snapshot file(s) the gate run wrote were approved as the runner's own output`);

	return written.length;
};
