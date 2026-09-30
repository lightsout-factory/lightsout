// Incorrect: writes its own copy of formatMoney when src/common/utils/ already
// has one. A fix to either copy now misses the other.
const formatMoney = ({ cents }: { cents: number }): string => `$${(cents / 100).toFixed(2)}`;

export const getInvoiceLabel = ({ cents }: { cents: number }): string => `Invoiced ${formatMoney({ cents })}`;
