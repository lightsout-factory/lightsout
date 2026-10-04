import { rateLimits } from './common/rateLimits.ts';
import type { Rate } from './common/Rate.ts';
import { formatRate } from './common/formatting/formatRate.ts';

export const chargeCustomer = ({ rate }: { rate: Rate }): string => `Rate ${formatRate({ rate })} of ${rateLimits.max}`;
