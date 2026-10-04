/** Fixed on purpose, with no configuration key, so the interface stays small. */
export const gateLockTimings = {
	/** Separate from each command's own execution timeout. */
	waitCeilingMs: 30 * 60_000,
	/** A gate run frees the machine at an unpredictable moment, and the next run should start promptly. */
	pollIntervalMs: 2_000,
	progressIntervalMs: 30_000,
} as const;
