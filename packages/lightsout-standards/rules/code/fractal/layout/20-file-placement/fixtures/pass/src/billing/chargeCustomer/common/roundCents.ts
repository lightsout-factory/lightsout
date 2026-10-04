// Correct: both files of the chargeCustomer module use this, and no file outside it.
export const roundCents = ({ cents }: { cents: number }): number => Math.round(cents);
