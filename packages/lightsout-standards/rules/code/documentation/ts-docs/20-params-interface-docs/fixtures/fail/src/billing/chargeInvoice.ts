/**
 * The arguments chargeInvoice takes.
 */
interface Params {
	invoiceId: string;
	payerName: string;
}

export const chargeInvoice = ({ invoiceId, payerName }: Params): string => `${invoiceId}${payerName}`;
