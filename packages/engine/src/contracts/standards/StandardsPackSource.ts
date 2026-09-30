/** How a group's standards pack was chosen. */
export const StandardsPackSource = {
	/** The config named the pack. */
	Named: 'named',
	/** Nothing named a pack, so lightsout picked one of its own from the package's dependencies. */
	Detected: 'detected',
} as const;

export type StandardsPackSource = (typeof StandardsPackSource)[keyof typeof StandardsPackSource];
