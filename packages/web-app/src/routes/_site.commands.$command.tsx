import { createFileRoute, notFound } from '@tanstack/react-router';
import { CommandDetailScreen } from '#src/commands/CommandDetailScreen/CommandDetailScreen.tsx';
import { CommandNotFoundScreen } from '#src/commands/CommandNotFoundScreen.tsx';
import { commandsQueryOptions } from '#src/commands/commandsQueryOptions.ts';

const CommandNotFound = () => {
	const { command } = Route.useParams();

	return <CommandNotFoundScreen command={command} />;
};

const CommandDetailPage = () => {
	const { command } = Route.useParams();

	return <CommandDetailScreen commandId={command} />;
};

export const Route = createFileRoute('/_site/commands/$command')({
	// The whole catalog is small static data, so the loader can answer a wrong id
	// here without a second round trip.
	loader: async ({ context, params }) => {
		const commands = await context.queryClient.ensureQueryData(commandsQueryOptions());

		if (!commands.some((entry) => entry.id === params.command)) {
			throw notFound();
		}
	},
	// From the path alone, so the tab is named before the query resolves.
	head: ({ params }) => ({ meta: [{ title: `${params.command} — lightsout command` }] }),
	component: CommandDetailPage,
	notFoundComponent: CommandNotFound,
});
