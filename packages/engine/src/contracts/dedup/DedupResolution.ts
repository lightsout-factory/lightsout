export const DedupResolution = {
	Reuse: 'reuse',
	Extend: 'extend',
	Extract: 'extract',
	Defer: 'defer',
	Distinct: 'distinct',
} as const;

export type DedupResolution = (typeof DedupResolution)[keyof typeof DedupResolution];
