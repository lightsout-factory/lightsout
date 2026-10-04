import { formatResumeCommand } from '#src/common/formatResumeCommand.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunUsage } from '#src/contracts/run/RunUsage.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { confirmOwnership } from '#src/phases/runPhasesPipeline/runPhase/common/confirmOwnership.ts';
import { persistStep } from '#src/phases/runPhasesPipeline/runPhase/common/persistStep.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
	index: number;
	step: StepRecord;
	total: number;
	childResult: PipelineResult;
	queueRunId?: string;
}

const recordFromChild = ({ step, childResult }: { step: StepRecord; childResult: PipelineResult }) => ({
	...step,
	status: childResult.manifest.status,
	attempts: step.attempts + 1,
	durationMs: childResult.manifest.steps.reduce((total, childStep) => total + (childStep.durationMs ?? 0), 0),
	report: { runId: childResult.manifest.runId },
	error: childResult.error,
});

const addUsage = ({ total, child }: { total?: RunUsage; child?: RunUsage }) => {
	if (!child) {
		return total;
	}

	if (!total) {
		return child;
	}

	return {
		invocations: total.invocations + child.invocations,
		inputTokens: total.inputTokens + child.inputTokens,
		outputTokens: total.outputTokens + child.outputTokens,
		cacheReadTokens: total.cacheReadTokens + child.cacheReadTokens,
		cacheCreationTokens: total.cacheCreationTokens + child.cacheCreationTokens,
		costUsd: total.costUsd + child.costUsd,
	};
};

/**
 * Records a phase whose child run finished, passed or not; a result means the
 * sequence stops here.
 *
 * @throws {Error} When the coordinator's owner record no longer names this process — no outcome is recorded.
 */
export const recordFinishedChild = async ({
	cwd,
	manifest,
	index,
	step,
	total,
	childResult,
	queueRunId,
}: Params): Promise<{ manifest: RunManifest; result?: PipelineResult }> => {
	const child = childResult.manifest;

	await confirmOwnership({ cwd, runId: manifest.runId, queueRunId });

	const current = await persistStep({
		cwd,
		manifest,
		index,
		record: recordFromChild({ step, childResult }),
		patch: {
			status: childResult.ok ? RunStatus.Running : child.status,
			changedFiles: [...new Set([...manifest.changedFiles, ...child.changedFiles])],
			// Each phase's entry carries its own child run id, and a resumed phase that
			// skips a passed child returns before this patch, so concatenating cannot double one.
			commits: [...manifest.commits, ...child.commits],
			usage: addUsage({ total: manifest.usage, child: child.usage }),
		},
	});

	if (childResult.ok) {
		return { manifest: current };
	}

	const resume = formatResumeCommand({ pipeline: PipelineKind.Phases, runId: current.runId });
	const stopped = `phase ${index + 1}/${total} (${step.id}) ended ${child.status} — resume with: ${resume}`;

	return { manifest: current, result: { ok: false, manifest: current, error: childResult.error ? `${stopped}\n${childResult.error}` : stopped } };
};
