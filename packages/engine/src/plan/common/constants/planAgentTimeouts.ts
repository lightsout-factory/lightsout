/**
 * The ceiling each plan agent gets when its caller names none. A judge's is
 * shorter than a reader's: a timed-out judge leaves its findings open, which
 * blocks and so costs one extra question, while a hung judge holding a slot
 * stalls the whole fan-out.
 */
export const planAgentTimeouts = {
	readerMs: 30 * 60_000,
	judgeMs: 10 * 60_000,
	dedupMs: 30 * 60_000,
	draftMs: 30 * 60_000,
} as const;
