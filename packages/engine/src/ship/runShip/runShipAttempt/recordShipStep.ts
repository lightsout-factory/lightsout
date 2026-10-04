import type { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import type { ShippingProgressRecorder } from '#src/ship/progress/ShippingProgressRecorder.ts';

export const recordShipStep = async <Answer>({
	recorder,
	step,
	run,
	passed,
}: {
	recorder: ShippingProgressRecorder;
	step: ShippingStepId;
	run: () => Promise<Answer>;
	passed: (answer: Answer) => boolean;
}): Promise<Answer> => {
	recorder.startStep({ step });

	const answer = await run();

	recorder.finishStep({ step, passed: passed(answer) });

	return answer;
};
