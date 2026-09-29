// Correct: billing and invoices both use this, and src/ is the lowest folder
// that holds both.
export const formatMoney = ({ cents }: { cents: number }): string => `$${(cents / 100).toFixed(2)}`;
