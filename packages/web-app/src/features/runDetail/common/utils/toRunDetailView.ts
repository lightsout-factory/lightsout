import type { RunView } from '@lightsout/engine';
import type { RunDetailView } from '#src/features/runDetail/internal/common/types/RunDetailView.ts';

interface Params {
	/** A run view exactly as the engine assembled it. */
	view: RunView;
}

/** Every report the engine writes is an object, so a primitive means a corrupt manifest and is dropped. */
export const toRunDetailView = ({ view }: Params): RunDetailView => ({
	...view,
	steps: view.steps.map((step) => ({
		...step,
		report: typeof step.report === 'object' && step.report !== null ? step.report : undefined,
	})),
});
