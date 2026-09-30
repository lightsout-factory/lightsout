// Incorrect: sits directly in common/. A function belongs in common/utils/.
export const formatRate = ({ rate }: { rate: number }): string => `${(rate * 100).toFixed(1)}%`;
