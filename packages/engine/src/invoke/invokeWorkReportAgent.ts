import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createEventFileSink } from '#src/common/createEventFileSink.ts';
import { resolveRunDir } from '#src/common/runs/resolveRunDir.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { Permissions } from '#src/contracts/Permissions.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts';
import { appendFriction } from '#src/runState/friction/appendFriction.ts';

interface Params {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	/** The step the invocation belongs to. It names the evidence files, the usage entry and the friction. */
	step: string;
	invocation: { systemPrompt: string; prompt: string };
	/** Usage-ledger suffix for this invocation: '' for the first, a name such as 'fix-N' for a later one. */
	label: string;
	/** 1-based invocation number within the step, for evidence file names. */
	invocationCount: number;
	agentTimeoutMs: number;
	/** Mutable collectors: agent-reported paths and friction lines accumulate here across invocations. */
	reportedFiles: Set<string>;
	rationale: string[];
	/** Runs once the agent has returned, whether or not its report was accepted, before its usage is recorded. */
	afterAgent?: () => Promise<void>;
	recordUsage: (params: { step: string; usage?: AgentUsage }) => Promise<void>;
}

/** One agent invocation that answers with a `WorkReport`, with its stream and any rejected output kept in the run's folder. */
export const invokeWorkReportAgent = async ({
	cwd,
	runId,
	driver,
	config,
	step,
	invocation,
	label,
	invocationCount,
	agentTimeoutMs,
	reportedFiles,
	rationale,
	afterAgent,
	recordUsage,
}: Params): Promise<Awaited<ReturnType<typeof invokeAgentWithContract<typeof WorkReport>>>> => {
	const agentsDir = join(await resolveRunDir({ cwd, runId }), 'agents');
	const slug = step.replace(/[:/]/g, '_');
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

	await afterAgent?.();
	await recordUsage({ step: `${step}${label ? ` ${label}` : ''}`, usage: outcome.usage });

	if (!outcome.ok) {
		return outcome;
	}

	for (const file of outcome.report.changedFiles) {
		reportedFiles.add(file.path);
	}

	if (outcome.report.friction && outcome.report.friction.length > 0) {
		await appendFriction({ cwd, runId, step, friction: outcome.report.friction });
		rationale.push(...outcome.report.friction.map((entry) => `[${entry.area}] ${entry.detail}`));
	}

	return outcome;
};
