import type { Rate } from './types/Rate.ts';

// Correct: a function, so it sits directly in common/.
export const formatRate = ({ rate }: { rate: Rate }): string => `${(rate.value * 100).toFixed(1)}%`;
