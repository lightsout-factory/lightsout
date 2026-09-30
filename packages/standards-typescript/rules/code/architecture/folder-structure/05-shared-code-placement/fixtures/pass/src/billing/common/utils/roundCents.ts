// Correct: only billing uses this, so it stays in billing.
export const roundCents = ({ cents }: { cents: number }): number => Math.round(cents);
