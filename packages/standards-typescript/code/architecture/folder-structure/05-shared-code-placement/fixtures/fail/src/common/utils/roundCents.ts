// Incorrect: only billing uses this, so it sits too high. It belongs in
// src/billing/common/utils/.
export const roundCents = ({ cents }: { cents: number }): number => Math.round(cents);
