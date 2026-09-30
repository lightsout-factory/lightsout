import { formatMoney } from './common/utils/formatMoney.ts';

// Correct: imports the formatMoney that src/common/utils/ already has.
export const getInvoiceLabel = ({ cents }: { cents: number }): string => `Invoiced ${formatMoney({ cents })}`;
