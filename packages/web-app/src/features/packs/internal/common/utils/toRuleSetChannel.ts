import { baseRuleSetSlug } from '#src/features/packs/internal/common/constants/baseRuleSetSlug.ts';

interface Params {
	ruleSet: string;
}

export const toRuleSetChannel = ({ ruleSet }: Params): string => (ruleSet === baseRuleSetSlug ? 'base' : ruleSet);
