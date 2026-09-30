import { formatRate } from './common/formatRate.ts';

export const billing = ({ rate }: { rate: number }): string => `Rate ${formatRate({ rate })}`;
