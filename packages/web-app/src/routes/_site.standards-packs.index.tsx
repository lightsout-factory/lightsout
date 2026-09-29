import { createFileRoute } from '@tanstack/react-router';
import { defaultPackQueryOptions } from '#src/features/packs/queries/defaultPackQueryOptions.ts';
import { PacksPage } from '#src/features/packs/screens/PacksPage/PacksPage.tsx';

export const Route = createFileRoute('/_site/standards-packs/')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(defaultPackQueryOptions());
	},
	component: PacksPage,
});
