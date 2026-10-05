import type { Rate } from '../Rate.ts';

// Incorrect: common/ holds three files, so it has no folder but types/ and
// constants/. A function sits directly in common/.
export const formatRate = ({ rate }: { rate: Rate }): string => `${(rate.value * 100).toFixed(1)}%`;
