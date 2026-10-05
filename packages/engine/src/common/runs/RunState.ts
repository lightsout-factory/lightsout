import { defaultAgentTimeoutMinutes } from '#src/common/constants/defaultAgentTimeoutMinutes.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunUsage } from '#src/contracts/run/RunUsage.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { createProgressSink } from '#src/runState/progress/createProgressSink.ts';
import { recordAgentUsage } from '#src/runState/recordAgentUsage/recordAgentUsage.ts';
import { seedUsageTotals } from '#src/runState/seedUsageTotals.ts';
import { writeManifestWithUsage } from '#src/runState/writeManifestWithUsage.ts';

const upsertStep = ({ steps, record }: { steps: StepRecord[]; record: StepRecord }) => {
	const existing = steps.findIndex((step) => step.id === record.id);

	if (existing === -1) {
		return [...steps, record];
	}

	return steps.map((step, index) => (index === existing ? record : step));
};

interface ConstructorParams {
	cwd: string;
	config: LightsoutConfig;
	/** Owned by the instance from here; read it via `current()`. */
	manifest: RunManifest;
	onProgress?: (message: string) => void;
}

/**
 * Steps mutate run state only through these methods, so the
 * persist-before-the-next-action ordering lives in one place for every pipeline.
 */
export class RunState {
	readonly cwd: string;
	readonly config: LightsoutConfig;
	readonly agentTimeoutMs: number;
	private manifest: RunManifest;
	private readonly usageTotals: RunUsage;
	private readonly onProgress?: (message: string) => void;
	// Teed to the run directory because a detached run has no stdout to tail.
	private readonly progressSink: (message: string) => void;

	constructor({ cwd, config, manifest, onProgress }: ConstructorParams) {
		this.cwd = cwd;
		this.config = config;
		this.manifest = manifest;
		this.onProgress = onProgress;
		this.progressSink = createProgressSink({ cwd, runId: manifest.runId });
		this.usageTotals = seedUsageTotals({ usage: manifest.usage });
		this.agentTimeoutMs = (config.timeouts?.['agent-minutes'] ?? defaultAgentTimeoutMinutes) * 60_000;
	}

	/** Reread after any update/setStep; callers must not cache it. */
	current(): RunManifest {
		return this.manifest;
	}

	progress(message: string): void {
		this.progressSink(message);
		this.onProgress?.(message);
	}

	async update({ patch }: { patch: Partial<RunManifest> }): Promise<void> {
		this.manifest = await writeManifestWithUsage({ cwd: this.cwd, manifest: this.manifest, patch, usageTotals: this.usageTotals });
	}

	async setStep({ record, patch }: { record: StepRecord; patch?: Partial<RunManifest> }): Promise<void> {
		await this.update({ patch: { ...patch, currentStep: record.id, steps: upsertStep({ steps: this.manifest.steps, record }) } });
	}

	async stop({ record, status, error, label }: { record: StepRecord; status: RunStatus; error: string; label: string }): Promise<void> {
		await this.setStep({ record: { ...record, status, error }, patch: { status } });
		this.progress(`${label} stopped at ${record.id} — ${status}`);
	}

	recordUsage({ step, usage }: { step: string; usage?: AgentUsage }): Promise<void> {
		return recordAgentUsage({
			cwd: this.cwd,
			runId: this.manifest.runId,
			step,
			model: this.config.model,
			effort: this.config.effort,
			totals: this.usageTotals,
			usage,
		});
	}
}
