import type { GradedGap } from '#src/contracts/plan/grade/GradedGap.ts';

export interface GapBatch {
	/** `index` is the finding's position in the pass's gap array. */
	observations: Array<{ id: string; index: number; gap: GradedGap }>;
	/** The text the judge reads and each citation is confirmed against. */
	planTexts: Array<{ phase: string; text: string }>;
}
