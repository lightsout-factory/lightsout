import { runFormatter } from '#src/common/processes/runFormatter.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';
import { invokeWorkReportAgent } from '#src/invoke/invokeWorkReportAgent.ts';

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
}: Params): ReturnType<typeof invokeWorkReportAgent> => {
	const outcome = await invokeWorkReportAgent({
		cwd,
		runId,
		driver,
		config,
		step: batch.id,
		invocation,
		label,
		invocationCount,
		agentTimeoutMs,
		reportedFiles,
		rationale,
		// Run even when the report is rejected: an agent that died mid-run still
		// wrote files, and the salvage path reads the same tree every other path does.
		afterAgent: async () => {
			const formatError = await runFormatter({ cwd, runId, config, step: batch.id });

			if (formatError) {
				// A formatter that cannot run is a human's configuration problem, not work
				// an agent can fix.
				onProgress(`${batch.id}: ${formatError}`);
			}
		},
		recordUsage,
	});

	if (!outcome.ok) {
		return outcome;
	}

	for (const entry of outcome.report.advisoryOutcomes ?? []) {
		advisoryOutcomes.set(entry.siteKey, entry);
	}

	return outcome;
};
