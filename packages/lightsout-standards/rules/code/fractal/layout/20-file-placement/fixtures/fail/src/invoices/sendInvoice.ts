import { chargeCustomer } from '../billing/chargeCustomer.ts';
import { formatMoney } from '../billing/common/formatMoney.ts';
import { refundCustomer } from '../billing/refundCustomer.ts';

export const sendInvoice = ({ cents }: { cents: number }): string => `${chargeCustomer({ cents })} ${refundCustomer({ cents })} ${formatMoney({ cents })}`;
