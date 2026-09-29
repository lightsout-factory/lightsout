export const RunCommand = {
	Implement: 'implement',
	ImplementPhased: 'implement · phased',
	Refactor: 'refactor',
	Coverage: 'coverage',
} as const;

export type RunCommand = (typeof RunCommand)[keyof typeof RunCommand];
