import { queryOptions } from '@tanstack/react-query';
import { getPlanWorkspaceServerFn } from '#src/features/plans/server/getPlanWorkspaceServerFn.ts';

interface Params {
	/** The workspace's kebab folder name, which is what the URL carries. */
	name: string;
}

/** Not polled: a workspace changes only when someone runs a planning command. */
export const planWorkspaceQueryOptions = ({ name }: Params) =>
	queryOptions({
		queryKey: ['planWorkspace', name],
		queryFn: () => getPlanWorkspaceServerFn({ data: { name } }),
	});
