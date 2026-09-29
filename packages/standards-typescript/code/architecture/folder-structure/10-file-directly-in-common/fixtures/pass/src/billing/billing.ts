import { formatRate } from './common/utils/formatRate.ts';

export const billing = ({ rate }: { rate: number }): string => `Rate ${formatRate({ rate })}`;
