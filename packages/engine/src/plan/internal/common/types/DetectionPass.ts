import type { getPlanDetectionPass } from '#src/plan/internal/common/utils/getPlanDetectionPass.ts';

export type DetectionPass = Awaited<ReturnType<typeof getPlanDetectionPass>>;
