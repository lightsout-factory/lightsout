import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { resolveNewRunDir } from '#src/common/resolveNewRunDir.ts';
import { resolveRunDir } from '#src/common/resolveRunDir.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { formatResumeCommand } from '#src/common/utils/formatResumeCommand.ts';
import { CoverageWorklist } from '#src/contracts/coverage/CoverageWorklist.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { runCoverageCheck } from '#src/coverage/runCoverageCheck.ts';
import { createRun } from '#src/runState/createRun.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';

interface Params {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	/** The config as it was read from disk, and its path, recorded on a fresh run. Ignored when resuming. */
	loadedConfig: LoadedConfig;
	/** Accept a dirty tree: the standing dirt is recorded as baseline, never attributed to a batch. */
	allowDirty?: boolean;
	existing?: RunManifest;
}

/**
 * A fresh run requires a clean tree so the ending diff is entirely the run's.
 * `allowDirty` trades that for a recorded baseline, as the refactor pipeline
 * does: the files dirty at start are excluded from batch attribution.
 *
 * @throws {Error} When coverage is opted out, the tree is dirty (and not accepted) or ungitted, or the run belongs to another pipeline.
 */
export const initializeCoverageRun = async ({
	cwd,
	runId,
	driver,
	config,
	loadedConfig,
	allowDirty = false,
	existing,
}: Params): Promise<{ manifest: RunManifest; worklist: CoverageWorklist }> => {
	if (existing) {
		const pipeline = existing.pipeline ?? PipelineKind.Implement;

		if (pipeline !== PipelineKind.Coverage) {
			const resume = formatResumeCommand({ pipeline, runId: existing.runId });

			throw new Error(`run ${existing.runId} belongs to the ${pipeline} pipeline — resume it with: ${resume}`);
		}

		// Read from the run's own directory rather than by joining the recorded
		// path onto `cwd`: run folders resolve against the primary checkout, so a
		// resume standing in a worktree would open a file that is not there.
		const frozen = join(await resolveRunDir({ cwd, runId: existing.runId }), 'worklist.json');

		const worklist = CoverageWorklist.parse(JSON.parse(await readFile(frozen, 'utf8')));

		await writeRunOwner({ cwd, runId: existing.runId });

		return { manifest: existing, worklist };
	}

	if (typeof config.gates['test-coverage'] !== 'string' && config['package-gates']?.['test-coverage'] === undefined) {
		throw new Error('the coverage gate is opted out ("test-coverage": false) — test-coverage-to-threshold has nothing to run');
	}

	const dirty = await readGitChangedFiles({ cwd });

	if (dirty === undefined) {
		throw new Error('test-coverage-to-threshold requires a git worktree — without git, changes cannot be attributed or reviewed as one diff.');
	}

	if (dirty.length > 0 && !allowDirty) {
		throw new Error(
			`test-coverage-to-threshold requires a clean tree — commit or stash first, or accept the standing changes as baseline with --allow-dirty. Dirty:\n${dirty.map((file) => `  ${file}`).join('\n')}`,
		);
	}

	const measured = await runCoverageCheck({ cwd, config });
	const worklist: CoverageWorklist = { at: new Date().toISOString(), totals: measured.totals, files: measured.files };
	const worklistPath = join(await resolveNewRunDir({ cwd, pipeline: PipelineKind.Coverage, runId }), 'worklist.json');
	// `createRun` records the path repo-relative and creates the folder, so the
	// write below lands in a directory that exists.
	const manifest = await createRun({
		cwd,
		runId,
		plan: worklistPath,
		pipeline: PipelineKind.Coverage,
		driver: driver.name,
		loadedConfig,
		baselineDirtyFiles: dirty,
	});

	await writeFile(worklistPath, `${JSON.stringify(worklist, undefined, '\t')}\n`, 'utf8');

	return { manifest, worklist };
};
