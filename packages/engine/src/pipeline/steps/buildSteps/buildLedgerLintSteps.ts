import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/common/types/PipelineStep.ts';

interface Params {
	run: PipelineRun;
	/** The plan lines whose acceptance-test ledger rows the engine could not read. */
	malformedLines: number[];
}

/** Implement must not be more lenient about malformed ledger rows than the plan-time lint is. */
export const buildLedgerLintSteps = ({ run, malformedLines }: Params): PipelineStep[] =>
	malformedLines.length === 0
		? []
		: [
				{
					id: 'check-ledger',
					run: async () =>
						run.stop({
							record: run.nextRecord({ id: 'check-ledger' }),
							status: RunStatus.Failed,
							error: `check-ledger: the plan's acceptance-test ledger has row(s) the engine cannot read, at line(s) ${malformedLines.join(', ')} — fix them in the plan and re-run.`,
						}),
				},
			];
