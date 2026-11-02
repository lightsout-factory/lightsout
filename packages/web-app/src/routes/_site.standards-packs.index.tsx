import { createFileRoute } from '@tanstack/react-router';
import { defaultPackQueryOptions } from '#src/packs/defaultPackQueryOptions.ts';
import { PacksScreen } from '#src/packs/PacksScreen/PacksScreen.tsx';

export const Route = createFileRoute('/_site/standards-packs/')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(defaultPackQueryOptions());
	},
	component: PacksScreen,
});
