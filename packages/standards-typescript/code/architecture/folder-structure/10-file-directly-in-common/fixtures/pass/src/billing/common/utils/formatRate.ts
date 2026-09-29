// Correct: a function, so it goes in common/utils/.
export const formatRate = ({ rate }: { rate: number }): string => `${(rate * 100).toFixed(1)}%`;
