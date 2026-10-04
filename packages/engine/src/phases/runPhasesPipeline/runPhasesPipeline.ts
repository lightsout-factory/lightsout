import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import { discardGeneratedChanges } from '#src/commit/discardGeneratedChanges.ts';
import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { formatResumeCommand } from '#src/common/utils/formatResumeCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { initializeSequence } from '#src/phases/runPhasesPipeline/initializeSequence/initializeSequence.ts';
import { runPhase } from '#src/phases/runPhasesPipeline/runPhase/runPhase.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { describeRunLockHolder } from '#src/runState/lock/describeRunLockHolder.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';
import { readLiveRunLock } from '#src/runState/lock/readLiveRunLock.ts';
import { withRunLock } from '#src/runState/lock/withRunLock.ts';
import { createProgressSink } from '#src/runState/progress/createProgressSink.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';

interface Params {
	cwd: string;
	driver: Driver;
	config: LightsoutConfig;
	/** The config as it was read from disk, before the command stamped its harness on it, and its path. The coordinator records it on a fresh sequence, and every phase child records the same value; on a resume it is the config the sequence recorded. */
	loadedConfig: LoadedConfig;
	/** Overview path for a fresh sequence (cwd-relative or absolute). Ignored when resuming (the manifest owns it). */
	overviewPath?: string;
	/** 1-based phase a fresh sequence starts from; earlier phases are recorded as passed outside the sequence. Default 1. */
	startPhase?: number;
	/** The id a fresh sequence's COORDINATOR is created under, minted by the caller. Each phase's child run gets its own id, settled by the coordinator before the child starts. */
	runId?: string;
	/** Resume: an existing coordinator manifest — phases already passed are skipped. */
	existing?: RunManifest;
	skipRefactor?: boolean;
	/** The command-run level each phase opens its own pass level under. Absent wherever no run is being recorded. */
	level?: ActivityLevel;
	/** Resolved before the run starts: a passing sequence will ship this branch. Stamped on the COORDINATOR only — a phase's child run must never draw a ship row it can never fill. */
	willShip?: boolean;
	onProgress?: (message: string) => void;
	/** The queue run a worker sequence belongs to; the coordinator's owner record points there. A phase run never gets an owner record. */
	queueRunId?: string;
}

/**
 * Every phase's commit leaves its build output on disk for the next phase, so
 * a passed sequence discards it once, leaving the tree as a single-phase build
 * does. Taken under the repo run lock because it writes the tree, and only
 * after every child has released that lock.
 *
 * @returns the sentence saying why the carried output is still on disk, or undefined once it is gone
 * @throws {RunLockError} When another run holds the repo lock.
 */
const discardCarriedGenerated = async ({
	cwd,
	config,
	runId,
	narrate,
}: {
	cwd: string;
	config: LightsoutConfig;
	runId: string;
	narrate: (message: string) => void;
}) => {
	const generated = config.generated ?? [];

	if (generated.length === 0) {
		return undefined;
	}

	return withRunLock({
		params: { cwd, runId, onProgress: narrate },
		run: async () => {
			const changed = await readGitChangedFiles({ cwd });

			// Never read as "nothing changed": the output may still be on disk.
			if (changed === undefined) {
				return `git could not read the tree at ${cwd}, so the carried generated changes were not discarded`;
			}

			const paths = changed.filter((path) => isGeneratedPath({ path, generated }));

			if (paths.length === 0) {
				return undefined;
			}

			const failure = await discardGeneratedChanges({ cwd, paths });

			if (failure === undefined) {
				narrate(`discarded ${paths.length} carried generated path(s) — the pre-ship step commits build output`);
			}

			return failure === undefined ? undefined : `git could not discard the carried generated changes in ${cwd}: ${failure}`;
		},
	});
};

/**
 * The coordinator holds no repo run lock across phases: each per-phase run
 * takes `.lightsout/lock.json` itself, and a lock held across phases would
 * deadlock the coordinator's own children. It takes the lock only for the
 * discard of carried build output, once every phase has passed. A live holder
 * is still refused before the sequence is initialized, because the
 * coordinator's manifest and owner record are written before any phase takes
 * the lock, and a refused start must leave neither behind. Before recording any
 * phase outcome the coordinator checks its owner record still names it, because
 * with no lock between phases two resumed processes could otherwise both drive
 * one sequence.
 *
 * The first phase that ends short of passing stops the whole sequence, because
 * later phases build on earlier ones.
 *
 * @throws {RunLockError} When a live run holds the repo lock at the start, a phase cannot take it, or, after every phase passed, the carried-output discard cannot take it — either way the sequence stays exactly resumable.
 * @throws {Error} When the coordinator's owner record names another process — this one stops without recording the phase.
 */
export const runPhasesPipeline = async ({
	cwd,
	driver,
	config,
	loadedConfig,
	overviewPath,
	startPhase,
	runId,
	existing,
	skipRefactor,
	level,
	willShip,
	onProgress,
	queueRunId,
}: Params): Promise<PipelineResult> => {
	const holder = await readLiveRunLock({ cwd });

	if (holder !== undefined) {
		throw new RunLockError(describeRunLockHolder({ holder }));
	}

	const initialized = await initializeSequence({ cwd, driver, loadedConfig, overviewPath, startPhase, runId, existing, willShip, queueRunId });

	let manifest = initialized.manifest;

	// The coordinator holds no RunState, so the tee that persists a run's
	// narration does not reach it; without this, `--watch` shows nothing between phases.
	const sink = createProgressSink({ cwd, runId: manifest.runId });
	const narrate = (message: string) => {
		sink(message);
		onProgress?.(message);
	};
	const total = manifest.steps.length;

	for (const [index, step] of manifest.steps.entries()) {
		if (step.status === RunStatus.Passed) {
			continue;
		}

		const phase = await runPhase({
			cwd,
			driver,
			config,
			loadedConfig,
			manifest,
			index,
			step,
			total,
			skipRefactor,
			level,
			onProgress: narrate,
			queueRunId,
		});

		manifest = phase.manifest;

		if (phase.result) {
			return phase.result;
		}
	}

	const discardFailure = await discardCarriedGenerated({ cwd, config, runId: manifest.runId, narrate });

	if (discardFailure !== undefined) {
		manifest = await writeRunManifest({ cwd, manifest: { ...manifest, status: RunStatus.Failed, currentStep: null } });

		const resume = formatResumeCommand({ pipeline: PipelineKind.Phases, runId: manifest.runId });

		return { ok: false, manifest, error: `every phase passed, but ${discardFailure} — resume with: ${resume}` };
	}

	manifest = await writeRunManifest({ cwd, manifest: { ...manifest, status: RunStatus.Passed, currentStep: null } });

	return { ok: true, manifest };
};
