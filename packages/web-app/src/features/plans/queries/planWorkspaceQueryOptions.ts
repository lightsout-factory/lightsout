import { queryOptions } from '@tanstack/react-query';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { getPlanWorkspaceServerFn } from '#src/features/plans/internal/serverFns/getPlanWorkspaceServerFn.ts';

interface Params {
	/** The workspace's kebab folder name, which is what the URL carries. */
	name: string;
}

/** Not polled: a workspace changes only when someone runs a planning command. */
export const planWorkspaceQueryOptions = ({ name }: Params) =>
	queryOptions({
		queryKey: [QueryKey.PlanWorkspace, name],
		queryFn: () => getPlanWorkspaceServerFn({ data: { name } }),
	});
