import { RefactorStepReport } from '#src/contracts/run/RefactorStepReport.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';

interface Params {
	run: PipelineRun;
}

/**
 * `undefined` rather than a throw for a record an older engine wrote: this runs on a resume,
 * where refusing to parse would strand the run over optional evidence.
 */
export const readPriorCleanup = ({ run }: Params): RefactorStepReport | undefined => {
	return RefactorStepReport.safeParse(run.current().steps.find((step) => step.id === 'refactor')?.report).data;
};
