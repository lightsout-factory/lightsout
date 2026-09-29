/** One value for both remote waits: the check wait and the merge read-back are the same policy, so a longer CI ceiling must move both. */
export const remoteWaitTimings = { pollIntervalMs: 30_000, ceilingMs: 30 * 60_000 } as const;
