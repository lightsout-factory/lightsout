import { queryOptions } from '@tanstack/react-query';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { getDefaultPackRuleServerFn } from '#src/features/packs/internal/serverFns/getDefaultPackRuleServerFn.ts';

interface Params {
	/** The rule id, as its folder spells it minus the numeric prefix. */
	rule: string;
}

/** Never stale: the pack is bundled into the app. */
export const defaultPackRuleQueryOptions = ({ rule }: Params) =>
	queryOptions({
		queryKey: [QueryKey.DefaultPackRule, rule],
		queryFn: () => getDefaultPackRuleServerFn({ data: { rule } }),
		staleTime: Number.POSITIVE_INFINITY,
	});
