import { baseRuleSetSlug } from '#src/features/packs/internal/common/constants/baseRuleSetSlug.ts';

interface Params {
	channel: string;
}

export const toRuleSetSlug = ({ channel }: Params): string => (channel === 'base' ? baseRuleSetSlug : channel);
