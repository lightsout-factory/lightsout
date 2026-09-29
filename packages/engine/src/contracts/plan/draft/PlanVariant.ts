/** The CLI `--scope phased` maps to `Overview`, the file that fronts the phase files. */
export const PlanVariant = {
	Single: 'single',
	Overview: 'overview',
	Phase: 'phase',
} as const;

export type PlanVariant = (typeof PlanVariant)[keyof typeof PlanVariant];
