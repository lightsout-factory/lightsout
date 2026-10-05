/**
 * Derived from the gate's kind rather than configured: no project has a unit
 * suite slower than its end-to-end suite, so a config key would be churn.
 */
export const GateTier = {
	/** Type-check, lint and the unit suite — fast enough to run at every checkpoint whatever else is red. */
	Cheap: 'cheap',
	/** Every custom `test-*` suite, and the build — paid for only once the cheap gates are green everywhere. */
	Expensive: 'expensive',
} as const;

export type GateTier = (typeof GateTier)[keyof typeof GateTier];
