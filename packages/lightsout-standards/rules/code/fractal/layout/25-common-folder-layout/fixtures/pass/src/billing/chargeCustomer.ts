import { rateLimits } from './common/constants/rateLimits.ts';
import { formatRate } from './common/formatRate.ts';
import type { Rate } from './common/types/Rate.ts';

export const chargeCustomer = ({ rate }: { rate: Rate }): string => `Rate ${formatRate({ rate })} of ${rateLimits.max}`;
