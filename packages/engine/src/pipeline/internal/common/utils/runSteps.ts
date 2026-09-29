import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { PipelineStep } from '#src/pipeline/internal/PipelineStep.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

interface Params {
	run: PipelineRun;
	steps: PipelineStep[];
}

/**
 * A step the manifest already records as passed is walked past, which is how
 * resume costs nothing for finished steps. A skipped step is recorded as a pass
 * with its reason, because the manifest has to explain the whole run.
 */
export const runSteps = async ({ run, steps }: Params): Promise<PipelineResult | undefined> => {
	for (const step of steps) {
		const prior = run.current().steps.find((record) => record.id === step.id);

		if (prior?.status === RunStatus.Passed) {
			continue;
		}

		const skipReason = step.skip?.();

		if (skipReason) {
			await run.setStep({
				record: { id: step.id, status: RunStatus.Passed, attempts: prior?.attempts ?? 0, report: { skipped: skipReason } },
			});
			run.progress(`step ${step.id} skipped (${skipReason})`);

			continue;
		}

		const stopped = await step.run();

		if (stopped) {
			return stopped;
		}
	}

	return undefined;
};
