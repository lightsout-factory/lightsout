// Incorrect: sendInvoice.ts uses this too, so it sits too low. It belongs in
// src/common/, the lowest folder that holds both users.
export const formatMoney = ({ cents }: { cents: number }): string => `$${(cents / 100).toFixed(2)}`;
