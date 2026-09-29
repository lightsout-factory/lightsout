export const CommandGroup = {
	Build: 'build',
	BurnDown: 'burn-down',
	Standards: 'standards',
	Housekeeping: 'housekeeping',
} as const;

export type CommandGroup = (typeof CommandGroup)[keyof typeof CommandGroup];
