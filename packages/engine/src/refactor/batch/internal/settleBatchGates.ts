import { maxCheapFixRetries } from '#src/common/constants/maxCheapFixRetries.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import { describeGateNoVerdict } from '#src/common/utils/describeGateNoVerdict.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { AgentUsage } from '#src/contracts/run/AgentUsage.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { GateRunResult } from '#src/gates/common/types/GateRunResult.ts';
import { SettleKind } from '#src/refactor/batch/internal/common/constants/SettleKind.ts';
import type { SettleOutcome } from '#src/refactor/batch/internal/common/types/SettleOutcome.ts';
import { superviseBatch } from '#src/refactor/batch/internal/superviseBatch.ts';

interface Params {
	cwd: string;
	runId: string;
	driver: Driver;
	config: LightsoutConfig;
	batchId: string;
	planContent: string;
	attempts: number;
	onProgress: (message: string) => void;
	recordUsage: (params: { step: string; usage?: AgentUsage }) => Promise<void>;
	/** One fix attempt through the caller's gate-kind routing — a red COVERAGE gate goes to the test writer, everything else back to the refactor executor. */
	invokeFix: (params: { label: string; gateError: string; guidance?: string }) => Promise<AgentOutcome<unknown>>;
	/** Run the batch's gates and answer their whole verdict — a red, a crash, or a run that never started. */
	gates: () => Promise<GateRunResult>;
}

/**
 * A gate run that reached no verdict ends the settle before either stage spends
 * more: there is nothing for a fix agent to repair or a supervisor to rule on.
 */
export const settleBatchGates = async ({
	cwd,
	runId,
	driver,
	config,
	batchId,
	planContent,
	attempts,
	onProgress,
	recordUsage,
	invokeFix,
	gates,
}: Params): Promise<SettleOutcome> => {
	let result = await gates();
	let outcome: SettleOutcome | undefined;

	for (let retry = 1; outcome === undefined && result.error && describeGateNoVerdict({ result }) === undefined && retry <= maxCheapFixRetries; retry += 1) {
		onProgress(`${batchId}: gate red — fix attempt ${retry}/${maxCheapFixRetries}`);

		const fix = await invokeFix({ label: `fix-${retry}`, gateError: result.error });

		if (!fix.ok && fix.rateLimited) {
			outcome = { kind: SettleKind.Parked };
		} else {
			result = await gates();
		}
	}

	const gateError = result.error;

	if (outcome === undefined) {
		const noVerdict = describeGateNoVerdict({ result });

		if (noVerdict !== undefined) {
			outcome = { kind: SettleKind.Escalated, error: noVerdict };
		} else if (!gateError) {
			outcome = { kind: SettleKind.Green };
		} else {
			outcome = await superviseBatch({
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
				invokeGuidedFix: ({ guidance }) => invokeFix({ label: 'supervised-fix', gateError, guidance }),
				gates,
			});
		}
	}

	return outcome;
};
