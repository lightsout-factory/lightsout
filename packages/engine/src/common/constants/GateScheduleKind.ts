/** Only the verification checkpoints ask for a schedule; every other gate caller passes none and gets `Single`. */
export const GateScheduleKind = {
	/** One stage, the engine's canonical order. */
	Single: 'single',
	/** Two stages, cheap then expensive, with every group held at the boundary. */
	Tiered: 'tiered',
	/** One stage, exactly these gate names in exactly this order, always stopping at the first red. */
	Exact: 'exact',
	/** No stages at all — the checkpoint runs no gates, `gates.generate` included. */
	Off: 'off',
} as const;

export type GateScheduleKind = (typeof GateScheduleKind)[keyof typeof GateScheduleKind];
