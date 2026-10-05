import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import { excludedSourcePaths } from '#src/common/sourceFiles/excludedSourcePaths.ts';
import { approvedTestsDir } from '#src/pipeline/approvedTests/common/approvedTestsDir.ts';
import { readApprovedTest } from '#src/pipeline/approvedTests/readApprovedTest.ts';
import { TestChangeKind } from '#src/pipeline/approvedTests/reviewTestChanges/common/constants/TestChangeKind.ts';
import type { TestChange } from '#src/pipeline/approvedTests/reviewTestChanges/common/types/TestChange.ts';
import { isTestSideFile } from '#src/pipeline/common/isTestSideFile.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';

/** The device path git reads as "this side of the diff is empty" — an addition's before, a removal's after. */
const emptySide = '/dev/null';

const kindOf = ({ live, approved }: { live?: string; approved?: string }) => {
	if (approved === undefined) {
		return TestChangeKind.Added;
	}

	return live === undefined ? TestChangeKind.Removed : TestChangeKind.Modified;
};

/**
 * `git diff --no-index` exits 1 when the two differ, which is the normal case
 * here, so stdout is what is read rather than the exit code.
 */
const diffOf = async ({ cwd, path, kind, approved, scratch }: { cwd: string; path: string; kind: TestChangeKind; approved?: string; scratch: string }) => {
	const before = join(scratch, path);

	if (approved !== undefined) {
		await mkdir(dirname(before), { recursive: true });
		await writeFile(before, approved, 'utf8');
	}

	const left = approved === undefined ? emptySide : relative(cwd, before);
	const right = kind === TestChangeKind.Removed ? emptySide : path;
	const [quotedLeft, quotedRight] = [left, right].map((argument) => quoteShellArgument({ argument }));
	const shown = await runCommand({ command: `git diff --no-index ${quotedLeft} ${quotedRight}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return shown !== undefined && shown.stdout.length > 0 ? shown.stdout : `${path}: ${kind} (no textual diff could be produced)`;
};

interface Params {
	run: PipelineRun;
}

/**
 * Candidates come from three routes at once, because each one alone has a blind
 * spot: git sees what actually changed, the manifest's changed-file list is what
 * survives the run's baseline subtraction, and a path the run already approved
 * has to be re-judged if it was edited again since. Generated and vendored
 * prefixes are dropped because a regenerated file is never an agent's edit.
 *
 * Sorted by path, so a re-entry hands the reviewer the same bundle it saw first.
 */
export const collectTestChanges = async ({ run }: Params): Promise<TestChange[]> => {
	const manifest = run.current();
	const excluded = excludedSourcePaths({ config: run.config });
	const seen = [...((await readGitChangedFiles({ cwd: run.cwd })) ?? []), ...manifest.changedFiles, ...manifest.approvedTests.map((record) => record.path)];
	const candidates = [...new Set(seen)].filter((path) => isTestSideFile({ path }) && !excluded.some((prefix) => path.startsWith(prefix))).sort();

	if (candidates.length === 0) {
		return [];
	}

	// Cleared and recreated per collection, so a stale approved side can never be
	// the thing a diff is taken against.
	const scratch = join(dirname(await approvedTestsDir({ cwd: run.cwd, runId: manifest.runId })), 'approved-scratch');

	await rm(scratch, { recursive: true, force: true });
	await mkdir(scratch, { recursive: true });

	const changes: TestChange[] = [];

	for (const path of candidates) {
		const live = await readFile(join(run.cwd, path), 'utf8').catch(() => undefined);
		const approved = await readApprovedTest({ run, path });

		if (live === approved) {
			continue;
		}

		const kind = kindOf({ live, approved });

		changes.push({ path, kind, diff: await diffOf({ cwd: run.cwd, path, kind, approved, scratch }) });
	}

	return changes;
};
