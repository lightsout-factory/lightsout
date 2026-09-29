/**
 * Retries a declined charge twice: the card network treats a third attempt
 * within a day as suspected fraud and blocks the card.
 */
export const chargeInvoice = ({ attempt }: { attempt: number }): boolean => attempt < 3;
