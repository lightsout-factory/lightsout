export const FixtureSide = {
	Pass: 'pass',
	Fail: 'fail',
} as const;

export type FixtureSide = (typeof FixtureSide)[keyof typeof FixtureSide];
