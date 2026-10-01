import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { initializeSequence } from '#src/phases/initializeSequence.ts';
import { runPhase } from '#src/phases/internal/runPhase/runPhase.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { describeRunLockHolder } from '#src/runState/lock/describeRunLockHolder.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';
import { readLiveRunLock } from '#src/runState/lock/readLiveRunLock.ts';
import { createProgressSink } from '#src/runState/progress/createProgressSink.ts';
import { writeRunManifest } from '#src/runState/writeRunManifest.ts';

interface Params {
	cwd: string;
	driver: Driver;
	config: LightsoutConfig;
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
 * The coordinator takes no repo run lock of its own: each per-phase run takes
 * `.lightsout/lock.json` itself, and a lock held across phases would deadlock
 * the coordinator's own children. A live holder is still refused before the
 * sequence is initialized, because the coordinator's manifest and owner record
 * are written before any phase takes the lock, and a refused start must leave
 * neither behind. Before recording any phase outcome the coordinator checks its
 * owner record still names it, because with no lock between phases two resumed
 * processes could otherwise both drive one sequence.
 *
 * The first phase that ends short of passing stops the whole sequence, because
 * later phases build on earlier ones.
 *
 * @throws {RunLockError} When a live run holds the repo lock at the start, or a phase cannot take it — nothing was created, rewritten or run, so the sequence stays exactly resumable.
 * @throws {Error} When the coordinator's owner record names another process — this one stops without recording the phase.
 */
export const runPhasesPipeline = async ({
	cwd,
	driver,
	config,
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

	const initialized = await initializeSequence({ cwd, driver, config, overviewPath, startPhase, runId, existing, willShip, queueRunId });

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
			manifest,
			index,
			step,
			total,
			resumed: existing !== undefined,
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

	manifest = await writeRunManifest({ cwd, manifest: { ...manifest, status: RunStatus.Passed, currentStep: null } });

	return { ok: true, manifest };
};
