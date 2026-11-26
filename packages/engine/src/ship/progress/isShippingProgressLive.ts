import type { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';
import { isPidAlive } from '#src/runState/liveness/isPidAlive.ts';

interface Params {
	progress: ShippingProgress;
}

/**
 * Judged by the end stamp first and the recorded pid second, so a finished
 * ship reads as finished whatever became of its process.
 */
export const isShippingProgressLive = ({ progress }: Params): boolean => progress.endedAt === undefined && isPidAlive({ pid: progress.pid });
