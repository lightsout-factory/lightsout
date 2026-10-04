import type { ActivityLevelKind } from '#src/contracts/activity/ActivityLevelKind.ts';
import type { HarnessProcessMark } from '#src/contracts/activity/HarnessProcessMark.ts';
import type { RunStatus } from '#src/contracts/run/RunStatus.ts';

/**
 * Passed explicitly rather than held in an ambient store, because an ambient
 * level would be lost across the fan-outs the engine runs agents in.
 *
 * `open`, `close` and `recordProcess` return synchronously and write through a
 * shared queue, so a hot path never awaits evidence and lines stay in call
 * order. `settled` is for callers that reach process exit right after closing.
 */
export interface ActivityLevel {
	/** The `parentId` of anything opened beneath this level. */
	readonly id: string;
	open: (params: { level: ActivityLevelKind; label: string }) => ActivityLevel;
	/** A second call writes nothing. */
	close: (params: { outcome: RunStatus }) => void;
	/** The mark less the two fields the handle already knows, so the contract stays the single statement of a recorded process. */
	recordProcess: (params: Omit<HarnessProcessMark, 'kind' | 'levelId'>) => void;
	/** Resolves once every mark written through this recorder has reached disk. */
	settled: () => Promise<void>;
}
