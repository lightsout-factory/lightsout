export const PlanWeight = {
	/** No readers: the structural lint and the ledger check are the grade. */
	Light: 'light',
	/** The reader fan-out runs once for this file. */
	Heavy: 'heavy',
} as const;

export type PlanWeight = (typeof PlanWeight)[keyof typeof PlanWeight];
