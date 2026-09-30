// Correct: the formatting functions share a folder named for their subject.
export const formatCurrency = ({ cents }: { cents: number }): string => `$${(cents / 100).toFixed(2)}`;
