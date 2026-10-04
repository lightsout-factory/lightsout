import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { formatResumeCommand } from '#src/common/utils/formatResumeCommand.ts';
import { writeJsonFile } from '#src/common/utils/writeJsonFile.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RefactorWorklist } from '#src/contracts/refactor/RefactorWorklist.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { buildWorklist } from '#src/refactor/internal/buildWorklist.ts';
import { resolveNewRunDir } from '#src/runState/common/paths/resolveNewRunDir.ts';
import { resolveRunDir } from '#src/runState/common/paths/resolveRunDir.ts';
import { createRun } from '#src/runState/createRun.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';

interface Params {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	/** The config as it was read from disk, and its path, recorded on a fresh run. Ignored when resuming. */
	loadedConfig: LoadedConfig;
	path?: string;
	all?: boolean;
	/** Accept a dirty tree: the standing dirt is recorded as baseline, never attributed to a batch. */
	allowDirty?: boolean;
	existing?: RunManifest;
}

/**
 * A fresh run requires a clean tree so the ending diff is entirely the run's.
 * `allowDirty` trades that for a recorded baseline excluded from batch
 * attribution; the pre-flight gates still stand.
 */
export const initializeRun = async ({
	cwd,
	runId,
	driver,
	config,
	loadedConfig,
	path,
	all,
	allowDirty = false,
	existing,
}: Params): Promise<{ manifest: RunManifest; worklist: RefactorWorklist }> => {
	if (existing) {
		const pipeline = existing.pipeline ?? PipelineKind.Implement;

		if (pipeline !== PipelineKind.Refactor) {
			const resume = formatResumeCommand({ pipeline, runId: existing.runId });

			throw new Error(`run ${existing.runId} belongs to the ${pipeline} pipeline — resume it with: ${resume}`);
		}

		// Read from the run's own directory rather than by joining the recorded
		// path onto `cwd`: run folders resolve against the primary checkout, so a
		// resume standing in a worktree would open a file that is not there.
		const frozen = join(await resolveRunDir({ cwd, runId: existing.runId }), 'worklist.json');

		const worklist = RefactorWorklist.parse(JSON.parse(await readFile(frozen, 'utf8')));

		await writeRunOwner({ cwd, runId: existing.runId });

		return { manifest: existing, worklist };
	}

	const dirty = await readGitChangedFiles({ cwd });

	if (dirty === undefined) {
		throw new Error('refactor requires a git worktree — without git, changes cannot be attributed or reviewed as one diff.');
	}

	if (dirty.length > 0 && !allowDirty) {
		throw new Error(
			`refactor requires a clean tree — commit or stash first, or accept the standing changes as baseline with --allow-dirty. Dirty:\n${dirty.map((file) => `  ${file}`).join('\n')}`,
		);
	}

	const worklist = await buildWorklist({ cwd, config, path, all });
	const worklistPath = join(await resolveNewRunDir({ cwd, pipeline: PipelineKind.Refactor, runId }), 'worklist.json');
	// `createRun` records the path repo-relative and creates the folder, so the
	// write below lands in a directory that exists.
	const manifest = await createRun({
		cwd,
		runId,
		plan: worklistPath,
		pipeline: PipelineKind.Refactor,
		driver: driver.name,
		loadedConfig,
		baselineDirtyFiles: dirty,
	});

	await writeJsonFile({ path: worklistPath, value: worklist });

	return { manifest, worklist };
};
