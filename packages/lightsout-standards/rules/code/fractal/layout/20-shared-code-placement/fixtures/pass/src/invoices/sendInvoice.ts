import { chargeCustomer } from '../billing/chargeCustomer/chargeCustomer.ts';
import { formatMoney } from '../common/formatMoney.ts';

export const sendInvoice = ({ cents }: { cents: number }): string => `${chargeCustomer({ cents })} ${formatMoney({ cents })}`;
