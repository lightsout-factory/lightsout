interface Params {
	/** The invoice id. */
	invoiceId: string;
	/** The payer name. */
	payerName: string;
}

/**
 * Charges an invoice.
 *
 * @param invoiceId - {string} The id of the invoice, a string
 * @param payerName - {string} The payer name, a string
 * @returns a string
 */
export const chargeInvoice = ({ invoiceId, payerName }: Params): string => `${invoiceId}${payerName}`;
