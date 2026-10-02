/** The run ids and process facts the `lightsout stop` cases seed on disk. */
export const stopCommandFixture = {
	rootId: '3f1c9a2e-7b4d-4e8a-9c1f-2a6b8d0e4f13',
	phaseChildId: '8b2d4f60-1c3e-4a5b-8d7f-9e0a1b2c3d4e',
	queueRunId: 'c7e9a1b3-5d2f-4c6e-8a0b-1d3f5e7a9c2b',
	otherRunId: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
	/** Beyond any OS pid range — the live-process probe reports it dead. */
	deadPid: 999_999_999,
	/** A start time no live child can have, so the recorded one no longer matches. */
	staleStartTime: 'Thu Jan  1 00:00:00 1970',
} as const;
