import { queryOptions } from '@tanstack/react-query';
import { QueryKey } from '#src/common/constants/QueryKey.ts';
import { listCommandsServerFn } from '#src/features/commands/internal/serverFns/listCommandsServerFn.ts';

/**
 * One query for the whole catalog: it is small static data that changes only
 * with the engine, so the detail page needs no second round trip and nothing
 * is polled.
 */
export const commandsQueryOptions = () =>
	queryOptions({
		queryKey: [QueryKey.Commands],
		queryFn: () => listCommandsServerFn(),
	});
