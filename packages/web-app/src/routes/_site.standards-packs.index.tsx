import { createFileRoute } from '@tanstack/react-router';
import { PacksScreen } from '#src/features/packs/screens/PacksScreen.tsx';
import { defaultPackQueryOptions } from '#src/queries/defaultPackQueryOptions.ts';

export const Route = createFileRoute('/_site/standards-packs/')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(defaultPackQueryOptions());
	},
	component: PacksScreen,
});
