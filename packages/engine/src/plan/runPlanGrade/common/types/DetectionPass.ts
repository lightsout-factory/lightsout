import type { getPlanDetectionPass } from '#src/plan/common/detection/getPlanDetectionPass.ts';

export type DetectionPass = Awaited<ReturnType<typeof getPlanDetectionPass>>;
