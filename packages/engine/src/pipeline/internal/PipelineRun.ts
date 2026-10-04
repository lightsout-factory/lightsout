import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatCost, formatTokenCount } from '@lightsout/shared';
import { resolveRunDir } from '#src/common/resolveRunDir.ts';
import { buildSelfCheckCommand } from '#src/common/selfCheck/buildSelfCheckCommand.ts';
import { RunState } from '#src/common/services/RunState.ts';
import type { ActivityLevel } from '#src/common/types/ActivityLevel.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { createEventFileSink } from '#src/common/utils/createEventFileSink.ts';
import { formatResumeCommand } from '#src/common/utils/formatResumeCommand.ts';
import { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { getAgentOutcomeStatus } from '#src/invoke/getAgentOutcomeStatus.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

const formatUsage = ({ usage }: { usage: AgentUsage }) =>
	`in ${formatTokenCount({ count: usage.inputTokens })} · out ${formatTokenCount({ count: usage.outputTokens })} · cache-read ${formatTokenCount({ count: usage.cacheReadTokens })} · ${formatCost({ usd: usage.costUsd })}`;

interface ConstructorParams {
	cwd: string;
	config: LightsoutConfig;
	driver: Driver;
	/** The run's manifest as loaded/created — the class owns it from here; read via `current()`. */
	manifest: RunManifest;
	/** The level this run's agent calls open their own step levels under. Absent wherever no run is being recorded. A single run is handed its command run's level; one phase of a sequence is handed that phase's pass level. */
	level?: ActivityLevel;
	onProgress?: (message: string) => void;
}

/**
 * Steps mutate run state only through these methods, so the
 * persist-before-next-action ordering lives in exactly one place.
 */
export class PipelineRun {
	/** Public: the supervisor consult invokes with its own contract/timeouts, outside invokeRole. */
	readonly driver: Driver;
	// The shared run state is held, not inherited, and private: `setStep` and
	// `recordUsage` add to what they forward, and a caller holding the state
	// could call the plain versions instead.
	private readonly runState: RunState;
	// Active time per step, accumulated across attempts and resumes: the
	// timer starts when nextRecord picks the step up (seeded with any prior
	// durationMs), and every manifest write re-stamps the running total — so
	// even a crashed run keeps the duration up to its last persisted moment.
	private readonly stepTimers = new Map<string, { startedAt: number; baseMs: number }>();
	private transcriptCount = 0;
	private rejectedCount = 0;
	private readonly level?: ActivityLevel;

	constructor({ cwd, config, driver, manifest, level, onProgress }: ConstructorParams) {
		this.runState = new RunState({ cwd, config, manifest, onProgress });
		this.driver = driver;
		this.level = level;
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

	update({ patch }: { patch: Partial<RunManifest> }): Promise<void> {
		return this.runState.update({ patch: this.withRunningStepTime({ patch }) });
	}

	// A long step writes the manifest several times without going through
	// setStep — a changed-file merge, a package-scope expansion. Re-stamping
	// the running step's timer on every write is what keeps its persisted
	// duration true as of updatedAt, which is what lets a reader tell a slow
	// step from a stuck one without a live process to ask.
	private withRunningStepTime({ patch }: { patch: Partial<RunManifest> }) {
		const steps = patch.steps ?? this.current().steps;
		const currentStep = patch.currentStep ?? this.current().currentStep;
		const timer = currentStep === null ? undefined : this.stepTimers.get(currentStep);

		if (timer === undefined) {
			return patch;
		}

		return {
			...patch,
			steps: steps.map((step) =>
				step.id === currentStep && step.status === RunStatus.Running ? { ...step, durationMs: timer.baseMs + (Date.now() - timer.startedAt) } : step,
			),
		};
	}

	parkMessage(): string {
		const { pipeline = PipelineKind.Implement, runId } = this.current();

		return `run parked: harness rate limited or overloaded — resume with \`${formatResumeCommand({ pipeline, runId })}\` when the window resets.`;
	}

	async setStep({ record, patch }: { record: StepRecord; patch?: Partial<RunManifest> }): Promise<void> {
		const timer = this.stepTimers.get(record.id);
		const timed = timer ? { ...record, durationMs: timer.baseMs + (Date.now() - timer.startedAt) } : record;

		await this.runState.setStep({ record: timed, patch });
	}

	nextRecord({ id }: { id: string }): StepRecord {
		const prev = this.current().steps.find((step) => step.id === id);

		this.stepTimers.set(id, { startedAt: Date.now(), baseMs: prev?.durationMs ?? 0 });

		return { id, status: RunStatus.Running, attempts: (prev?.attempts ?? 0) + 1, changedFiles: prev?.changedFiles };
	}

	async stop({ record, status, error }: { record: StepRecord; status: RunStatus; error: string }): Promise<PipelineResult> {
		await this.setStep({ record: { ...record, status, error }, patch: { status } });
		this.progress(`run stopped at ${record.id} — ${status}`);

		return { ok: false, manifest: this.current(), error };
	}

	async recordUsage({ step, usage }: { step: string; usage?: AgentUsage }): Promise<void> {
		await this.runState.recordUsage({ step, usage });

		if (usage) {
			this.progress(`  ${step} · usage: ${formatUsage({ usage })}`);
		}
	}

	/** Open one step level under this run's own level, for an agent call that does not go through `invokeRole`. Answers undefined when no run is being recorded. */
	openStepLevel({ step }: { step: string }): ActivityLevel | undefined {
		return this.level?.open({ level: ActivityLevelKind.Step, label: step });
	}

	// Every agent invocation's full event stream is teed to
	// agents/stream-NN-<step>.jsonl as run evidence, never narrated per event: a
	// working agent fires tools every few seconds. Outcomes never depend on it.
	agentEventSink({ step }: { step: string }): (event: unknown) => void {
		this.transcriptCount += 1;

		const name = `stream-${String(this.transcriptCount).padStart(2, '0')}-${step}.jsonl`;
		// The run's folder is looked up inside the promise the sink already took,
		// so the sink still returns synchronously; the transcript's file name is
		// fixed before that promise settles. `path` and `ready` are one promise,
		// so a lookup that fails is handled whether or not an event ever arrives.
		const path = resolveRunDir({ cwd: this.cwd, runId: this.current().runId }).then(async (runDir) => {
			const dir = join(runDir, 'agents');

			await mkdir(dir, { recursive: true });

			return join(dir, name);
		});

		return createEventFileSink({ path, ready: path });
	}

	// A final message that fails its contract is still evidence, so it is
	// persisted before any retry.
	persistRejected({ step }: { step: string }): (params: { text: string; attempt: number; validationError: string }) => Promise<void> {
		return async ({ text, attempt, validationError }) => {
			this.rejectedCount += 1;

			const dir = join(await resolveRunDir({ cwd: this.cwd, runId: this.current().runId }), 'agents');
			const name = `rejected-${String(this.rejectedCount).padStart(2, '0')}-${step}-attempt${attempt}.txt`;

			await mkdir(dir, { recursive: true });
			await writeFile(join(dir, name), `# step: ${step} · invocation attempt ${attempt}\n# validation: ${validationError}\n\n${text}`, 'utf8');
			this.progress(`step ${step}: agent final message failed the report contract — raw text saved to ${join(dir, name)}`);
		};
	}

	// onFirstEvent fires once, on the invocation's first streamed event — the
	// moment the harness's response began, and so the moment a prompt-cache
	// entry for this system prompt becomes readable by a concurrent spawn.
	// Drivers with no event stream never fire it; callers must not depend on it
	// for outcomes.
	async invokeRole({
		invocation,
		step,
		onFirstEvent,
	}: {
		invocation: { systemPrompt: string; prompt: string };
		step: string;
		onFirstEvent?: () => void;
	}): Promise<Awaited<ReturnType<typeof invokeAgentWithContract<typeof WorkReport>>>> {
		const sink = this.agentEventSink({ step });
		const stepLevel = this.openStepLevel({ step });
		let seenFirst = false;

		const outcome = await invokeAgentWithContract({
			driver: this.driver,
			cwd: this.cwd,
			invocation,
			contract: WorkReport,
			model: this.config.model,
			effort: this.config.effort,
			permissions: this.config.permissions ?? Permissions.Write,
			timeoutMs: this.agentTimeoutMs,
			// Harness-level allowance for all working roles; the binding grant
			// is the prompt section, which only the executor's builders emit. The
			// engine's own self-check prefix rides the same allowance, so a role
			// never told about it still cannot be blocked from one it was told about.
			allowedCommands: [...(this.config['agent-commands'] ?? []), buildSelfCheckCommand({ cwd: this.cwd, runId: this.current().runId }).prefix],
			onEvent: (event) => {
				if (!seenFirst) {
					seenFirst = true;
					onFirstEvent?.();
				}

				sink(event);
			},
			onRejectedOutput: this.persistRejected({ step }),
			activity: stepLevel,
		});

		// Closed before the usage record below, so the level's span is the agent
		// call rather than the manifest write and the progress line that follow it.
		stepLevel?.close({ outcome: getAgentOutcomeStatus({ outcome }) });

		await this.recordUsage({ step, usage: outcome.usage });

		return outcome;
	}
}
