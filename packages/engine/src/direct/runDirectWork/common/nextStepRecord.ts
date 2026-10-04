import type { RunState } from '#src/common/RunState.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';

interface Params {
	run: RunState;
	id: string;
}

export const nextStepRecord = ({ run, id }: Params): StepRecord => ({
	id,
	status: RunStatus.Running,
	attempts: (run.current().steps.find((step) => step.id === id)?.attempts ?? 0) + 1,
});
