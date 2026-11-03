export const BadgeVariant = {
	Neutral: 'neutral',
	Running: 'running',
	Passed: 'passed',
	Failed: 'failed',
	Paused: 'paused',
	Escalated: 'escalated',
	Blocking: 'blocking',
	Advisory: 'advisory',
	Brand: 'brand',
} as const;

export type BadgeVariant = (typeof BadgeVariant)[keyof typeof BadgeVariant];
