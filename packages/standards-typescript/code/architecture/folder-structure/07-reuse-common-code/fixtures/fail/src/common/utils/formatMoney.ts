// Shared by getChargeLabel and getInvoiceLabel, so it lives in src/common/utils/.
export const formatMoney = ({ cents }: { cents: number }): string => `$${(cents / 100).toFixed(2)}`;
