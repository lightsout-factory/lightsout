import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { ActivityLevel } from '#src/activity/common/types/ActivityLevel.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { PhaseReport } from '#src/contracts/run/PhaseReport.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { confirmOwnership } from '#src/phases/runPhasesPipeline/runPhase/common/confirmOwnership.ts';
import { persistStep } from '#src/phases/runPhasesPipeline/runPhase/common/persistStep.ts';
import { recordFinishedChild } from '#src/phases/runPhasesPipeline/runPhase/recordFinishedChild.ts';
import { refuseDirtyPhaseStart } from '#src/phases/runPhasesPipeline/runPhase/refuseDirtyPhaseStart.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { runImplementPipeline } from '#src/pipeline/runImplementPipeline.ts';
import { RunLockError } from '#src/runState/lock/RunLockError.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';

/**
 * The child run a step already names, when there is one — a step that names a
 * run may be a crash between the child finishing and the coordinator recording
 * it, and the child's own manifest settles which.
 */
const readRecordedChild = async ({ cwd, step }: { cwd: string; step: StepRecord }) => {
	const recorded = PhaseReport.safeParse(step.report);

	return recorded.success ? await readRunManifest({ cwd, runId: recorded.data.runId }).catch(() => undefined) : undefined;
};

/**
 * Every throw becomes this phase's recorded failure except a lock it could not
 * take, which means nothing ran.
 *
 * @throws {RunLockError} When the phase cannot take the repo lock.
 */
const runChild = async (params: Parameters<typeof runImplementPipeline>[0]): Promise<PipelineResult | { failure: string }> => {
	let result: PipelineResult | { failure: string };

	try {
		result = await runImplementPipeline(params);
	} catch (error) {
		if (error instanceof RunLockError) {
			throw error;
		}

		result = { failure: messageOf({ error }) };
	}

	return result;
};

/** The child's id stays named on the failed step, so a resume adopts the partly built run. */
const recordThrownChild = async ({
	cwd,
	manifest,
	index,
	step,
	childRunId,
	failure,
	queueRunId,
}: {
	cwd: string;
	manifest: RunManifest;
	index: number;
	step: StepRecord;
	childRunId: string;
	failure: string;
	queueRunId?: string;
}) => {
	await confirmOwnership({ cwd, runId: manifest.runId, queueRunId });

	const current = await persistStep({
		cwd,
		manifest,
		index,
		record: { ...step, status: RunStatus.Failed, error: failure, report: { runId: childRunId } },
		patch: { status: RunStatus.Failed },
	});

	return { manifest: current, result: { ok: false, manifest: current, error: failure } };
};

interface PhaseParams {
	cwd: string;
	driver: Driver;
	config: LightsoutConfig;
	/** The coordinator's value, handed to every child it creates. */
	loadedConfig: LoadedConfig;
	manifest: RunManifest;
	index: number;
	step: StepRecord;
	total: number;
	skipRefactor?: boolean;
	/** The command-run level this phase's own pass level is opened under. Absent wherever no run is being recorded. */
	level?: ActivityLevel;
	onProgress?: (message: string) => void;
	/** The queue run the coordinator's owner record points at, for a queue worker sequence. Read only by the owner fence. */
	queueRunId?: string;
}

/**
 * No result means carry on to the next phase. The child's run id is settled
 * and recorded on the running step before the child starts, so a reader can
 * always tell which run of the family is moving.
 *
 * @throws {RunLockError} When the phase cannot take the repo lock — nothing ran, so the sequence stays exactly resumable.
 * @throws {Error} When the coordinator's owner record no longer names this process — no outcome is recorded.
 */
export const runPhase = async ({
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
	onProgress,
	queueRunId,
}: PhaseParams): Promise<{ manifest: RunManifest; result?: PipelineResult }> => {
	const label = `phase ${index + 1}/${total}: ${step.id}`;

	onProgress?.(label);

	const childManifest = await readRecordedChild({ cwd, step });

	if (childManifest?.status === RunStatus.Passed) {
		await confirmOwnership({ cwd, runId: manifest.runId, queueRunId });

		return { manifest: await persistStep({ cwd, manifest, index, record: { ...step, status: RunStatus.Passed } }) };
	}

	// Before the step is persisted running or its pass level opened, so a refusal
	// never leaves the phase looking half-run.
	const refused = await refuseDirtyPhaseStart({ cwd, config, manifest, index, step, queueRunId });

	if (refused !== undefined) {
		return refused;
	}

	// A step naming a run that cannot be read re-runs the phase in a new run.
	const childRunId = childManifest?.runId ?? randomUUID();
	const current = await persistStep({
		cwd,
		manifest,
		index,
		record: { ...step, status: RunStatus.Running, error: undefined, report: { runId: childRunId } },
		patch: { status: RunStatus.Running, currentStep: step.id },
	});

	// Opened only below the already-passed guard, so a phase a resume finds
	// finished writes no zero-length row for work no process did, and closed in a
	// `finally` so a lock the child could not take still ends the level.
	const pass = level?.open({ level: ActivityLevelKind.Pass, label });
	let outcome: RunStatus = RunStatus.Failed;

	try {
		const childResult = await runChild({
			cwd,
			driver,
			config,
			loadedConfig,
			runId: childRunId,
			planPath: join(dirname(current.plan), step.id),
			overviewPath: current.plan,
			parentRunId: current.runId,
			existing: childManifest,
			skipRefactor,
			// The coordinator discards the carried build output once the whole sequence passes.
			keepGenerated: true,
			level: pass,
			onProgress,
		});

		if ('failure' in childResult) {
			return await recordThrownChild({ cwd, manifest: current, index, step, childRunId, failure: childResult.failure, queueRunId });
		}

		outcome = childResult.manifest.status;

		return await recordFinishedChild({ cwd, manifest: current, index, step, total, childResult, queueRunId });
	} finally {
		pass?.close({ outcome });
	}
};
