import type { getPlanDetectionPass } from '#src/plan/common/getPlanDetectionPass.ts';

export type DetectionPass = Awaited<ReturnType<typeof getPlanDetectionPass>>;
