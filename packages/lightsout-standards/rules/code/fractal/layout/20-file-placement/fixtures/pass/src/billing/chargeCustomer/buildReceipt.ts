import { roundCents } from './common/roundCents.ts';

// Correct: only chargeCustomer.ts uses this, so it sits beside it.
export const buildReceipt = ({ cents }: { cents: number }): string => `Receipt ${roundCents({ cents })}`;
