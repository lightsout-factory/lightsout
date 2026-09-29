import type { RunView } from '@lightsout/engine';
import type { RunDetailStep } from '#src/features/runDetail/internal/common/types/RunDetailStep.ts';

export interface RunDetailView extends Omit<RunView, 'steps'> {
	steps: RunDetailStep[];
}
