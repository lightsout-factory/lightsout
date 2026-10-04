// Incorrect: only chargeCustomer.ts uses this, yet it sits at the top of
// billing as if other folders used it. It belongs in chargeCustomer's folder.
export const buildReceipt = ({ cents }: { cents: number }): string => `Receipt ${cents}`;
