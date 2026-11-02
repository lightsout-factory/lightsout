import { createFileRoute } from '@tanstack/react-router';
import { CommandsScreen } from '#src/commands/CommandsScreen/CommandsScreen.tsx';
import { commandsQueryOptions } from '#src/commands/commandsQueryOptions.ts';

export const Route = createFileRoute('/_site/commands/')({
	// The catalog is engine source rather than repo state, so this resolves on a
	// build with no repo under it.
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(commandsQueryOptions());
	},
	head: () => ({ meta: [{ title: 'Commands' }] }),
	component: CommandsScreen,
});
