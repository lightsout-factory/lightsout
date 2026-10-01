export const PiVariant = {
	Pi: 'pi',
	Omp: 'omp',
} as const;

export type PiVariant = (typeof PiVariant)[keyof typeof PiVariant];
