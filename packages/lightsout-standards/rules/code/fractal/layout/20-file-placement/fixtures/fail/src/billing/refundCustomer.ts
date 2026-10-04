import { taxRate } from './taxRate.ts';

export const refundCustomer = ({ cents }: { cents: number }): number => cents * taxRate;
