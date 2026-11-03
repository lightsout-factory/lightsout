import { createFileRoute } from '@tanstack/react-router';
import { commandsQueryOptions } from '#src/features/commands/queries/commandsQueryOptions.ts';
import { CommandsScreen } from '#src/features/commands/screens/CommandsScreen.tsx';

export const Route = createFileRoute('/_site/commands/')({
	// The catalog is engine source rather than repo state, so this resolves on a
	// build with no repo under it.
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(commandsQueryOptions());
	},
	head: () => ({ meta: [{ title: 'Commands' }] }),
	component: CommandsScreen,
});
