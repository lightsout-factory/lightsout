export const SettleKind = {
	Green: 'green',
	/** Resumable, not an error. */
	Parked: 'parked',
	Escalated: 'escalated',
} as const;

export type SettleKind = (typeof SettleKind)[keyof typeof SettleKind];
