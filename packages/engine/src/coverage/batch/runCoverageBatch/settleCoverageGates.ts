import { maxCheapFixRetries } from '#src/common/constants/maxCheapFixRetries.ts';
import { describeGateNoVerdict } from '#src/common/gates/describeGateNoVerdict.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { GateRunResult } from '#src/common/types/GateRunResult.ts';
import { CoverageBatchStopKind } from '#src/coverage/common/constants/CoverageBatchStopKind.ts';
import type { CoverageBatchStop } from '#src/coverage/common/types/CoverageBatchStop.ts';

interface Params {
	batchId: string;
	onProgress: (message: string) => void;
	invokeFix: (params: { label: string; errorContext: string }) => Promise<AgentOutcome<unknown>>;
	/** The tests-only verdict on what the batch has written — the error message, or undefined when only tests changed. */
	testsOnly: () => Promise<string | undefined>;
	/** Run the batch's gates and answer their whole verdict — a red, a crash, or a run that never started. */
	gates: () => Promise<GateRunResult>;
}

/**
 * Escalated rather than failed: a batch nobody could verify is a human's call,
 * not a batch that was judged and lost.
 */
const noVerdictStop = ({ result }: { result: GateRunResult }): CoverageBatchStop | undefined => {
	const error = describeGateNoVerdict({ result });

	return error === undefined ? undefined : { kind: CoverageBatchStopKind.Escalated, error };
};

/**
 * There is no supervisor stage here, unlike the refactor batch's settler: a
 * coverage batch that cannot be made green is set aside for a human with the
 * gate output attached, and the run continues on the next batch.
 *
 * A gate run that reached no verdict ends the settle at once and spends no fix
 * invocation: there is nothing about the batch to repair.
 */
export const settleCoverageGates = async ({ batchId, onProgress, invokeFix, testsOnly, gates }: Params): Promise<CoverageBatchStop | undefined> => {
	let result = await gates();
	let stop: CoverageBatchStop | undefined = noVerdictStop({ result });

	for (let retry = 1; result.error && stop === undefined && retry <= maxCheapFixRetries; retry += 1) {
		onProgress(`${batchId}: gate red — fix attempt ${retry}/${maxCheapFixRetries}`);

		const fix = await invokeFix({ label: `fix-${retry}`, errorContext: result.error });

		if (!fix.ok && fix.rateLimited) {
			stop = { kind: CoverageBatchStopKind.Parked };
		} else {
			const violation = await testsOnly();

			if (violation) {
				stop = { kind: CoverageBatchStopKind.Failed, error: violation };
			} else {
				result = await gates();
				stop = noVerdictStop({ result });
			}
		}
	}

	if (stop === undefined && result.error) {
		stop = { kind: CoverageBatchStopKind.Failed, error: `${batchId}: gates still red after ${maxCheapFixRetries} fix attempt(s)\n${result.error}` };
	}

	return stop;
};
