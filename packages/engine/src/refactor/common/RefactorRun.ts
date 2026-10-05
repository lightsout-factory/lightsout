import { RunState } from '#src/common/runs/RunState.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { RefactorResult } from '#src/refactor/RefactorResult.ts';

interface ConstructorParams {
	cwd: string;
	config: LightsoutConfig;
	/** The run's manifest as loaded/created — the class owns it from here; read via `current()`. */
	manifest: RunManifest;
	/** Declines rebuilt from persisted step reports on resume; the run appends to it. */
	declined: RefactorResult['declined'];
	/** Finding counts per rule at run start, from the frozen worklist. */
	before: Record<string, number>;
	onProgress?: (message: string) => void;
}

/**
 * Pipeline steps mutate run state only through these methods, so the
 * persist-before-the-next-action ordering lives in exactly one place.
 */
export class RefactorRun {
	readonly declined: RefactorResult['declined'];
	readonly before: Record<string, number>;
	// The shared run state is held, not inherited, and never published:
	// PipelineRun adds a step timer and a usage line to two of the same methods,
	// and one way in per run is what makes such additions unskippable.
	private readonly runState: RunState;

	constructor({ cwd, config, manifest, declined, before, onProgress }: ConstructorParams) {
		this.runState = new RunState({ cwd, config, manifest, onProgress });
		this.declined = declined;
		this.before = before;
	}

	get cwd(): string {
		return this.runState.cwd;
	}

	get config(): LightsoutConfig {
		return this.runState.config;
	}

	get agentTimeoutMs(): number {
		return this.runState.agentTimeoutMs;
	}

	/** The live manifest — reread after any update/setStep, never cached by callers. */
	current(): RunManifest {
		return this.runState.current();
	}

	progress(message: string): void {
		this.runState.progress(message);
	}

	parkMessage(): string {
		return this.runState.parkMessage();
	}

	update({ patch }: { patch: Partial<RunManifest> }): Promise<void> {
		return this.runState.update({ patch });
	}

	setStep({ record, patch }: { record: StepRecord; patch?: Partial<RunManifest> }): Promise<void> {
		return this.runState.setStep({ record, patch });
	}

	recordUsage({ step, usage }: { step: string; usage?: AgentUsage }): Promise<void> {
		return this.runState.recordUsage({ step, usage });
	}

	/**
	 * The result for a run that ends before the final whole-scope re-check —
	 * with no fresh count, the burn-down's after side can only honestly be its
	 * before side.
	 */
	buildHaltedResult({ error }: { error: string }): RefactorResult {
		return { ok: false, manifest: this.current(), error, declined: this.declined, before: this.before, after: this.before };
	}

	async stop({ record, status, error }: { record: StepRecord; status: RunStatus; error: string }): Promise<RefactorResult> {
		await this.runState.stop({ record, status, error, label: 'refactor run' });

		return this.buildHaltedResult({ error });
	}
}
