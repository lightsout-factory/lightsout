import { queryOptions } from '@tanstack/react-query';
import { getDefaultPackRuleServerFn } from '#src/packs/server/getDefaultPackRuleServerFn.ts';

interface Params {
	/** The rule id, as its folder spells it minus the numeric prefix. */
	rule: string;
}

/** Never stale: the pack is bundled into the app. */
export const defaultPackRuleQueryOptions = ({ rule }: Params) =>
	queryOptions({
		queryKey: ['defaultPackRule', rule],
		queryFn: () => getDefaultPackRuleServerFn({ data: { rule } }),
		staleTime: Number.POSITIVE_INFINITY,
	});
