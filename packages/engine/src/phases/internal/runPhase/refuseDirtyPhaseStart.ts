import { describeUncommittableTree } from '#src/commit/describeUncommittableTree.ts';
import { formatResumeCommand } from '#src/common/utils/formatResumeCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { confirmOwnership } from '#src/phases/internal/runPhase/common/utils/confirmOwnership.ts';
import { persistStep } from '#src/phases/internal/runPhase/common/utils/persistStep.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { isLightsoutWorktree } from '#src/worktree/records/isLightsoutWorktree.ts';

interface Params {
	cwd: string;
	config: LightsoutConfig;
	/** The coordinator's manifest. */
	manifest: RunManifest;
	index: number;
	step: StepRecord;
	queueRunId?: string;
}

/**
 * A phase starting for the first time commits everything in the tree, so in a
 * checkout a person chose, an edit made while the sequence ran or sat parked
 * would ride into that phase's commit. Only a pending step with no report is
 * judged: a running or failed one may hold its own half-done edits, which must
 * not be blamed on a person. Generated paths are exempt because each phase
 * leaves its build output on disk for the next.
 *
 * A refusal fails the coordinator but leaves the step pending, so the next
 * resume starts the phase afresh.
 *
 * @returns undefined when the phase may start, or the coordinator's failed outcome
 * @throws {Error} When the coordinator's owner record no longer names this process — no outcome is recorded.
 */
export const refuseDirtyPhaseStart = async ({
	cwd,
	config,
	manifest,
	index,
	step,
	queueRunId,
}: Params): Promise<{ manifest: RunManifest; result: PipelineResult } | undefined> => {
	if (step.status !== RunStatus.Pending || step.report !== undefined) {
		return undefined;
	}

	const resume = formatResumeCommand({ pipeline: PipelineKind.Phases, runId: manifest.runId });
	const refusal = await describeUncommittableTree({
		cwd,
		isolated: await isLightsoutWorktree({ cwd, branch: manifest.branch }),
		generated: config.generated ?? [],
		remedy: `stash them, then resume with: ${resume}`,
	});

	let refused: { manifest: RunManifest; result: PipelineResult } | undefined;

	if (refusal !== undefined) {
		await confirmOwnership({ cwd, runId: manifest.runId, queueRunId });

		// The step record is written back unchanged, so it stays pending and names no run.
		const current = await persistStep({ cwd, manifest, index, record: step, patch: { status: RunStatus.Failed, currentStep: step.id } });

		refused = { manifest: current, result: { ok: false, manifest: current, error: `phase ${step.id} was not started: ${refusal}` } };
	}

	return refused;
};
