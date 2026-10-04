// Incorrect: one file uses this, so it is not shared. It belongs beside
// chargeCustomer.ts.
export const roundCents = ({ cents }: { cents: number }): number => Math.round(cents);
