import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import { consultSupervisor } from '#src/common/utils/consultSupervisor.ts';
import { createEventFileSink } from '#src/common/utils/createEventFileSink.ts';
import { describeGateNoVerdict } from '#src/common/utils/describeGateNoVerdict.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import { SupervisorDecision } from '#src/contracts/work/SupervisorDecision.ts';
import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';
import { SettleKind } from '#src/refactor/batch/internal/common/constants/SettleKind.ts';
import type { SettleOutcome } from '#src/refactor/batch/internal/common/types/SettleOutcome.ts';
import { resolveRunDir } from '#src/runState/common/paths/resolveRunDir.ts';

interface Params {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	batchId: string;
	planContent: string;
	/** The gate output that survived the cheap fix retries. */
	gateError: string;
	attempts: number;
	maxCheapFixRetries: number;
	onProgress: (message: string) => void;
	recordUsage: (params: { step: string; usage?: AgentUsage }) => Promise<void>;
	invokeGuidedFix: (params: { guidance: string }) => Promise<AgentOutcome<unknown>>;
	/** Re-run the batch's gates after the guided fix, answering their whole verdict. */
	gates: () => Promise<GateRunResult>;
}

const consultBatchSupervisor = async ({
	cwd,
	runId,
	driver,
	config,
	planContent,
	batchId,
	gateError,
	attempts,
}: {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	planContent: string;
	batchId: string;
	gateError: string;
	attempts: number;
}) => {
	const agentsDir = join(await resolveRunDir({ cwd, runId }), 'agents');
	const slug = batchId.replace(/[:/]/g, '_');

	await mkdir(agentsDir, { recursive: true });

	return consultSupervisor({
		driver,
		cwd,
		config,
		planContent,
		stepId: batchId,
		errorOutput: gateError,
		attempts,
		onEvent: createEventFileSink({ path: join(agentsDir, `stream-${slug}-supervisor.jsonl`) }),
		onRejectedOutput: async ({ text, attempt }) => {
			await writeFile(join(agentsDir, `rejected-${slug}-supervisor-${attempt}.txt`), text, 'utf8').catch(() => undefined);
		},
	});
};

/**
 * The re-run after the guided fix can reach no verdict at all, and that
 * escalates naming the reason rather than reporting gates still red, which no
 * command established.
 */
export const superviseBatch = async ({
	cwd,
	runId,
	driver,
	config,
	batchId,
	planContent,
	gateError,
	attempts,
	maxCheapFixRetries,
	onProgress,
	recordUsage,
	invokeGuidedFix,
	gates,
}: Params): Promise<SettleOutcome> => {
	onProgress(`${batchId}: gates red after ${maxCheapFixRetries} cheap fix attempt(s) — consulting supervisor`);

	const verdict = await consultBatchSupervisor({ cwd, runId, driver, config, planContent, batchId, gateError, attempts });

	await recordUsage({ step: `${batchId}:supervisor`, usage: verdict.usage });

	const ruling = verdict.ok ? verdict.report : undefined;

	if (ruling) {
		onProgress(`${batchId}: supervisor verdict — ${ruling.decision}`);
	}

	let outcome: SettleOutcome | undefined;
	let remainingError: string | undefined = gateError;
	let noVerdict: string | undefined;

	if (!verdict.ok && verdict.rateLimited) {
		outcome = { kind: SettleKind.Parked };
	} else if (ruling?.decision === SupervisorDecision.Retry && ruling.guidance) {
		const fix = await invokeGuidedFix({
			guidance: `# Supervisor diagnosis\n${ruling.diagnosis}\n\n# Supervisor guidance\n${ruling.guidance}`,
		});

		if (!fix.ok && fix.rateLimited) {
			outcome = { kind: SettleKind.Parked };
		} else {
			const rerun = await gates();

			remainingError = rerun.error;
			noVerdict = describeGateNoVerdict({ result: rerun });
		}
	}

	if (outcome === undefined) {
		if (noVerdict !== undefined) {
			outcome = { kind: SettleKind.Escalated, error: noVerdict };
		} else if (remainingError) {
			const diagnosis = ruling ? `\nsupervisor (${ruling.decision}): ${ruling.diagnosis}` : '';

			outcome = {
				kind: SettleKind.Escalated,
				error: `${batchId}: gates still red after ${maxCheapFixRetries} fix attempt(s) and a supervisor consult.${diagnosis}\n\n${remainingError}`,
			};
		} else {
			outcome = { kind: SettleKind.Green };
		}
	}

	return outcome;
};
