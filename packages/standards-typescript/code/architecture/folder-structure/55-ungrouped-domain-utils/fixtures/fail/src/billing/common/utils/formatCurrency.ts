// Incorrect: formatCurrency and formatDate share a subject, formatting, but
// sit loose in utils/.
export const formatCurrency = ({ cents }: { cents: number }): string => `$${(cents / 100).toFixed(2)}`;
