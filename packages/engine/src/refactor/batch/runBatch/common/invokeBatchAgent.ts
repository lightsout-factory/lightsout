import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createEventFileSink } from '#src/common/createEventFileSink.ts';
import { runFormatter } from '#src/common/processes/runFormatter.ts';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts';
import { appendFriction } from '#src/runState/friction/appendFriction.ts';

interface Params {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	batch: RefactorBatch;
	invocation: { systemPrompt: string; prompt: string };
	/** Usage-ledger suffix: '' | 'requeue' | 'fix-N'. */
	label: string;
	/** 1-based, for evidence file names. */
	invocationCount: number;
	agentTimeoutMs: number;
	/** Mutable; accumulates across invocations. */
	reportedFiles: Set<string>;
	rationale: string[];
	/** Keyed by site so a later answer replaces the earlier one. */
	advisoryOutcomes: Map<string, AdvisoryOutcome>;
	onProgress: (message: string) => void;
	recordUsage: (params: { step: string; usage?: AgentUsage }) => Promise<void>;
}

/**
 * The engine runs the repo's formatter after every invocation: the executor is
 * barred from repository commands so it cannot verify its own work, and a
 * formatter verifies nothing, so the engine runs it rather than have the agent
 * imitate house style. Every batch write arrives through here, and a re-check of
 * unformatted code reports line numbers no later pass agrees with.
 */
export const invokeBatchAgent = async ({
	cwd,
	runId,
	driver,
	config,
	batch,
	invocation,
	label,
	invocationCount,
	agentTimeoutMs,
	reportedFiles,
	rationale,
	advisoryOutcomes,
	onProgress,
	recordUsage,
}: Params): Promise<Awaited<ReturnType<typeof invokeAgentWithContract<typeof WorkReport>>>> => {
	const agentsDir = join(await resolveRunDir({ cwd, runId }), 'agents');
	const slug = batch.id.replace(/[:/]/g, '_');
	const streamPath = join(agentsDir, `stream-${slug}-${invocationCount}.jsonl`);

	await mkdir(agentsDir, { recursive: true });

	const outcome = await invokeAgentWithContract({
		driver,
		cwd,
		invocation,
		contract: WorkReport,
		model: config.model,
		effort: config.effort,
		permissions: config.permissions ?? Permissions.Write,
		timeoutMs: agentTimeoutMs,
		allowedCommands: config['agent-commands'],
		onEvent: createEventFileSink({ path: streamPath }),
		onRejectedOutput: async ({ text, attempt }) => {
			await writeFile(join(agentsDir, `rejected-${slug}-${invocationCount}-${attempt}.txt`), text, 'utf8').catch(() => undefined);
		},
	});

	// Before the `ok` check below: an agent that died mid-run still wrote files,
	// and the salvage path reads the same tree every other path does.
	const formatError = await runFormatter({ cwd, runId, config, step: batch.id });

	if (formatError) {
		// A formatter that cannot run is a human's configuration problem, not work
		// an agent can fix.
		onProgress(`${batch.id}: ${formatError}`);
	}

	await recordUsage({ step: `${batch.id}${label ? ` ${label}` : ''}`, usage: outcome.usage });

	if (!outcome.ok) {
		return outcome;
	}

	for (const file of outcome.report.changedFiles) {
		reportedFiles.add(file.path);
	}

	for (const entry of outcome.report.advisoryOutcomes ?? []) {
		advisoryOutcomes.set(entry.siteKey, entry);
	}

	if (outcome.report.friction && outcome.report.friction.length > 0) {
		await appendFriction({ cwd, runId, step: batch.id, friction: outcome.report.friction });
		rationale.push(...outcome.report.friction.map((entry) => `[${entry.area}] ${entry.detail}`));
	}

	return outcome;
};
