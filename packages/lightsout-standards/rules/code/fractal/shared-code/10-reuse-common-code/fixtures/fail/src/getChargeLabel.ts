import { formatMoney } from './common/utils/formatMoney.ts';

export const getChargeLabel = ({ cents }: { cents: number }): string => `Charged ${formatMoney({ cents })}`;
