import { createFileRoute, notFound } from '@tanstack/react-router';
import { AppLayout } from '#src/layouts/AppLayout.tsx';
import { repoRootQueryOptions } from '#src/queries/repoRootQueryOptions.ts';
import { isPublicDeployment } from '#src/utils/isPublicDeployment.ts';

/**
 * The public-site check sits in `beforeLoad` so every page under `/app` answers
 * not-found without a line of its own. The server functions refuse on their own
 * too, so this is what the reader sees, not what keeps the disk private.
 *
 * The repo root is fetched here rather than in a loader because loaders run side
 * by side, and a server started outside any repo should show one message
 * naming the fix rather than a failure per page.
 */
export const Route = createFileRoute('/app')({
	beforeLoad: async ({ context }) => {
		if (isPublicDeployment()) {
			throw notFound();
		}

		await context.queryClient.ensureQueryData(repoRootQueryOptions());
	},
	component: AppLayout,
});
