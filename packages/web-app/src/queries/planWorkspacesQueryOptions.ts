import { queryOptions } from '@tanstack/react-query';
import { listPlanWorkspacesServerFn } from '#src/server/listPlanWorkspacesServerFn.ts';

/** Not polled: a workspace changes only when someone runs a planning command. */
export const planWorkspacesQueryOptions = () =>
	queryOptions({
		queryKey: ['planWorkspaces'],
		queryFn: () => listPlanWorkspacesServerFn(),
	});
