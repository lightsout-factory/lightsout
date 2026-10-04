/**
 * Distinct from `PlanVariant`, and the two unions must not share a literal:
 * `PlanVariant.Single` would compile against a plan-file kind and silently never
 * equal it.
 */
export const PlanFileKind = {
	Implementable: 'implementable',
	Overview: 'overview',
} as const;

export type PlanFileKind = (typeof PlanFileKind)[keyof typeof PlanFileKind];
